// 简单的账号密码登录系统
// session cookie 签名格式: admin.<timestamp>.<hmac-sha256签名>
// 同时支持 Node.js runtime（用 crypto 模块）和 Edge Runtime（用 Web Crypto）

// ============ 配置读取 ============

export function getAuthSecret(): string {
  if (process.env.NEXTAUTH_SECRET) return process.env.NEXTAUTH_SECRET
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET
  if (process.env.GITHUB_CLIENT_SECRET) return process.env.GITHUB_CLIENT_SECRET
  return 'fallback-please-set-nextauth-secret-in-vercel'
}

export function getAdminCredentials(): { username: string; password: string } {
  const username = process.env.ADMIN_USERNAME || process.env.GITHUB_CLIENT_ID || 'admin'
  const password = process.env.ADMIN_PASSWORD || process.env.GITHUB_CLIENT_SECRET || 'admin123'
  return { username, password }
}

function getGitHubToken(): string {
  if (process.env.GITHUB_PAT) return process.env.GITHUB_PAT
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN
  if (process.env.GITHUB_CLIENT_SECRET) return process.env.GITHUB_CLIENT_SECRET
  return 'admin-session-token'
}

// ============ 签名核心：检测运行时并选择合适的 crypto API ============

const COOKIE_NAME = 'navsphere_admin_session'
const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 天

function bytesToHex(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0')
  }
  return out
}

// 返回 hex 字符串 —— 同时支持 Node.js crypto 和 Web Crypto
async function hmacHex(message: string, secretKey: string): Promise<string> {
  // --- 方案 A: Node.js crypto 模块（最稳定，Vercel 默认 runtime） ---
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodeCrypto = require('crypto') as any
    if (nodeCrypto?.createHmac) {
      return nodeCrypto.createHmac('sha256', secretKey).update(message).digest('hex')
    }
  } catch { /* require 在 Edge Runtime 中不可用，忽略 */ }

  // --- 方案 B: Web Crypto (globalThis.crypto.subtle) —— Edge Runtime 和 Node.js 18+ ---
  const g = globalThis as any
  if (g.crypto?.subtle) {
    const enc = new TextEncoder()
    const key = await g.crypto.subtle.importKey(
      'raw',
      enc.encode(secretKey),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify']
    )
    const sigBuf = await g.crypto.subtle.sign('HMAC', key, enc.encode(message))
    return bytesToHex(new Uint8Array(sigBuf))
  }

  throw new Error('No crypto API available for HMAC signing')
}

// ============ Session API ============

export async function createSessionCookie(): Promise<string> {
  const payload = 'admin.' + Date.now()
  const secret = getAuthSecret()
  const sig = await hmacHex(payload, secret)
  return payload + '.' + sig
}

export async function verifySessionCookie(cookieValue: string): Promise<boolean> {
  if (!cookieValue) return false
  const idx = cookieValue.lastIndexOf('.')
  if (idx < 0) return false
  const payload = cookieValue.slice(0, idx)
  const sig = cookieValue.slice(idx + 1)
  if (sig.length < 32) return false

  const secret = getAuthSecret()
  const expected = await hmacHex(payload, secret)
  if (sig !== expected) return false

  const parts = payload.split('.')
  if (parts[0] !== 'admin') return false
  const ts = parseInt(parts[1], 10)
  if (!ts) return false
  if (Date.now() - ts >= SESSION_MAX_AGE * 1000) return false
  return true
}

// ============ Cookie 解析工具 ============

function parseCookieString(cookieHeader: string, name: string): string | null {
  if (!cookieHeader) return null
  const pairs = cookieHeader.split(';')
  for (const pair of pairs) {
    const trimmed = pair.trim()
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq)
    if (key === name) {
      const value = trimmed.slice(eq + 1)
      try { return decodeURIComponent(value) } catch { return value }
    }
  }
  return null
}

// 从各种来源中提取 session cookie 的值
function extractSessionCookie(
  source?: string | Request | Headers | null
): string | null {
  if (!source) return null
  if (typeof source === 'string') {
    return parseCookieString(source, COOKIE_NAME)
  }
  // Headers 对象或 Response 对象（有 .get 方法）
  if (typeof (source as any).get === 'function') {
    try {
      const cookieHeader = (source as Headers).get('cookie')
      return parseCookieString(cookieHeader || '', COOKIE_NAME)
    } catch { return null }
  }
  // Request 对象
  if ((source as Request).headers) {
    try {
      const cookieHeader = (source as Request).headers.get('cookie')
      return parseCookieString(cookieHeader || '', COOKIE_NAME)
    } catch { return null }
  }
  return null
}

// ============ 对外 API ============

// auth(source): 从提供的 source 中读取 cookie 并校验
// source 可以是: Cookie 字符串、Request 对象、Headers 对象
// 不传 source 时，会尝试从 Next.js headers() 上下文读取
export async function auth(
  source?: string | Request | Headers | null
): Promise<{
  user: { accessToken: string; name: string; email: string }
} | null> {
  try {
    let cookieValue: string | null = null

    if (source) {
      cookieValue = extractSessionCookie(source)
    }

    // 如果没提供 source，尝试从 Next.js 上下文读取
    if (!cookieValue) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod = require('next/headers') as any
        if (mod.headers) {
          const h = mod.headers()
          // Next.js 15 中 headers() 返回 Promise<Headers>
          const hdr: any = h && typeof h.then === 'function' ? await h : h
          if (hdr) {
            cookieValue = parseCookieString(hdr.get('cookie') || '', COOKIE_NAME)
          }
        }
      } catch { /* 在构建/预渲染阶段 headers() 不可用 */ }
    }

    if (!cookieValue) return null
    const valid = await verifySessionCookie(cookieValue)
    if (!valid) return null
    return {
      user: {
        accessToken: getGitHubToken(),
        name: '管理员',
        email: 'admin@navsphere.local',
      },
    }
  } catch {
    return null
  }
}

export async function isLoggedIn(
  source?: string | Request | Headers | null
): Promise<boolean> {
  const session = await auth(source)
  return session !== null
}

export async function getCurrentUser(
  source?: string | Request | Headers | null
): Promise<{ name: string; email: string } | null> {
  const session = await auth(source)
  if (!session) return null
  return { name: session.user.name, email: session.user.email }
}

export function getCookieConfig() {
  return {
    name: COOKIE_NAME,
    maxAge: SESSION_MAX_AGE,
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
  }
}

export { COOKIE_NAME }
