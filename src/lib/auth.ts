// 简单的账号密码登录系统
// 签名: SHA-256(value + ':' + secret) 取前 32 位 hex
// 同时兼容 Node.js runtime 和 Edge Runtime
import { cookies } from 'next/headers'

// ============ 配置读取 ============

// 用于签名 cookie 的 secret，按优先级读取
export function getAuthSecret(): string {
  if (process.env.NEXTAUTH_SECRET) return process.env.NEXTAUTH_SECRET
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET
  if (process.env.GITHUB_CLIENT_SECRET) return process.env.GITHUB_CLIENT_SECRET
  return 'fallback-please-set-nextauth-secret-in-vercel'
}

// 读取管理员账号和密码
export function getAdminCredentials(): { username: string; password: string } {
  const username = process.env.ADMIN_USERNAME || process.env.GITHUB_CLIENT_ID || 'admin'
  const password = process.env.ADMIN_PASSWORD || process.env.GITHUB_CLIENT_SECRET || 'admin123'
  return { username, password }
}

// 读取 GitHub 访问 Token（用于 API 写入仓库）
function getGitHubToken(): string {
  if (process.env.GITHUB_PAT) return process.env.GITHUB_PAT
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN
  if (process.env.GITHUB_CLIENT_SECRET) return process.env.GITHUB_CLIENT_SECRET
  return 'admin-session-token'
}

// ============ 签名 / 校验 (纯 Web Crypto + hex) ============

const COOKIE_NAME = 'navsphere_admin_session'
const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 天
const SIGNATURE_LEN = 32 // 取 SHA-256 哈希 hex 的前 32 位做签名

// Uint8Array -> hex
function bytesToHex(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0')
  }
  return out
}

// hex -> Uint8Array（校验时用）
function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    out[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return out
}

// 获取 crypto.subtle（Node.js 20+ 和 Edge Runtime 都原生支持）
function getSubtle(): SubtleCrypto {
  const g = globalThis as any
  if (g.crypto?.subtle) return g.crypto.subtle
  // Node.js 18 的兜底（虽然本项目 engines >= 20）
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nc = require('crypto')
    if (nc?.webcrypto?.subtle) return nc.webcrypto.subtle
  } catch { /* noop */ }
  throw new Error('crypto.subtle not available')
}

// 计算 SHA-256，返回 hex 字符串
async function sha256Hex(text: string): Promise<string> {
  const subtle = getSubtle()
  const data = new TextEncoder().encode(text)
  const hashBuffer = await subtle.digest('SHA-256', data)
  return bytesToHex(new Uint8Array(hashBuffer))
}

// 签名: payload -> "payload:signature"
async function signPayload(payload: string, secret: string): Promise<string> {
  const sig = await sha256Hex(payload + ':' + secret)
  return payload + ':' + sig.slice(0, SIGNATURE_LEN)
}

// 校验签名，返回 payload 或 null
async function verifyPayload(signed: string, secret: string): Promise<string | null> {
  const idx = signed.lastIndexOf(':')
  if (idx < 0) return null
  const payload = signed.slice(0, idx)
  const sig = signed.slice(idx + 1)
  const expected = (await sha256Hex(payload + ':' + secret)).slice(0, SIGNATURE_LEN)
  if (sig.length !== SIGNATURE_LEN) return null
  if (expected !== sig) return null
  return payload
}

// ============ Session API ============

export async function createSessionCookie(): Promise<string> {
  const payload = 'admin.' + Date.now()
  const secret = getAuthSecret()
  return signPayload(payload, secret)
}

export async function verifySessionCookie(cookieValue: string): Promise<boolean> {
  if (!cookieValue) return false
  const secret = getAuthSecret()
  const payload = await verifyPayload(cookieValue, secret)
  if (!payload) return false
  const parts = payload.split('.')
  if (parts[0] !== 'admin') return false
  const ts = parseInt(parts[1], 10)
  if (!ts) return false
  if (Date.now() - ts >= SESSION_MAX_AGE * 1000) return false
  return true
}

// ============ 读取 Cookie 并校验登录态 ============

// 从请求上下文读取 session cookie 并校验
async function readSessionCookie(): Promise<string | null> {
  try {
    const cookieResult: any = cookies()
    let store: any = null
    if (cookieResult && typeof cookieResult.then === 'function') {
      store = await cookieResult
    } else {
      store = cookieResult
    }
    if (!store) return null
    const found = store.get(COOKIE_NAME)
    return found?.value ?? null
  } catch {
    return null
  }
}

// ============ 对外 API（向后兼容） ============

export async function auth(): Promise<{
  user: { accessToken: string; name: string; email: string }
} | null> {
  try {
    const cookieValue = await readSessionCookie()
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

export async function isLoggedIn(): Promise<boolean> {
  const session = await auth()
  return session !== null
}

export async function getCurrentUser(): Promise<{ name: string; email: string } | null> {
  const session = await auth()
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
