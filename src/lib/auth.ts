// 纯 Web Crypto 实现的登录系统
// 不依赖 Node.js crypto 模块，完全使用标准 Web API
// 兼容 Node.js 18+ 和 Edge Runtime

const COOKIE_NAME = 'navsphere_admin_session'
const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 天

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

// ============ 签名核心：只用 Web Crypto API ============

function bytesToHex(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0')
  }
  return out
}

// 全局 crypto 对象（Node.js 18+ 和 Edge Runtime 都支持）
const crypto = (globalThis as any).crypto

async function hmacHex(message: string, secretKey: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return bytesToHex(new Uint8Array(sigBuf))
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
  if (sig.length !== 64) return false // SHA-256 hex 是 64 位

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

function extractSessionCookie(
  source?: string | Request | Headers | null
): string | null {
  if (!source) return null
  if (typeof source === 'string') {
    return parseCookieString(source, COOKIE_NAME)
  }
  if (typeof (source as any).get === 'function') {
    try {
      const cookieHeader = (source as Headers).get('cookie')
      return parseCookieString(cookieHeader || '', COOKIE_NAME)
    } catch { return null }
  }
  if ((source as Request).headers) {
    try {
      const cookieHeader = (source as Request).headers.get('cookie')
      return parseCookieString(cookieHeader || '', COOKIE_NAME)
    } catch { return null }
  }
  return null
}

// ============ 对外 API ============

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
