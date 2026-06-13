// 简单的账号密码登录系统 —— 不依赖 NextAuth，同时兼容 Node.js 和 Edge Runtime
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
export function getAdminCredentials() {
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

// ============ Session Cookie (HMAC-SHA256) ============

const COOKIE_NAME = 'navsphere_admin_session'
const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 天

// Uint8Array -> base64（Node.js 18+ 和 Edge Runtime 都提供 btoa）
function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return globalThis.btoa(binary)
}

// 使用 Web Crypto API（Node.js 18+ 和 Edge Runtime 都原生支持 globalThis.crypto.subtle）
async function hmacSign(message: string, secretKey: string): Promise<string> {
  const subtle = globalThis.crypto.subtle
  const enc = new TextEncoder()
  const keyData = await subtle.digest('SHA-256', enc.encode(secretKey))
  const key = await subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
  const sigBuffer = await subtle.sign('HMAC', key, enc.encode(message))
  return bytesToBase64(new Uint8Array(sigBuffer))
}

export async function createSessionCookie(): Promise<string> {
  const payload = `admin.${Date.now()}`
  const sig = await hmacSign(payload, getAuthSecret())
  return `${payload}.${sig}`
}

export async function verifySessionCookie(cookieValue: string): Promise<boolean> {
  if (!cookieValue) return false
  const idx = cookieValue.lastIndexOf('.')
  if (idx < 0) return false
  const payload = cookieValue.slice(0, idx)
  const sig = cookieValue.slice(idx + 1)
  const parts = payload.split('.')
  if (parts[0] !== 'admin') return false
  const timestamp = parseInt(parts[1], 10)
  if (!timestamp) return false
  if (Date.now() - timestamp >= SESSION_MAX_AGE * 1000) return false
  const expected = await hmacSign(payload, getAuthSecret())
  return sig === expected
}

// ============ 读取 Cookie ============

// 从请求上下文读取 session cookie。try-catch 确保构建期不会出错
async function readSessionCookie(): Promise<string | null> {
  try {
    // cookies() 在 Next.js 不同版本可能返回 Promise 或直接对象，
    // 用类型 cast 绕过 TS 类型差异，运行时统一用 Promise.all 风格处理
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
    // cookies() 在构建期/非请求上下文内会报错，此时返回 null
    return null
  }
}

// ============ 对外 API ============

// 向后兼容: 模拟原来 NextAuth 的 auth() 返回结构
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

// 检查是否已登录（供 layout 使用）
export async function isLoggedIn(): Promise<boolean> {
  const session = await auth()
  return session !== null
}

// 获取当前用户信息
export async function getCurrentUser(): Promise<{ name: string; email: string } | null> {
  const session = await auth()
  if (!session) return null
  return { name: session.user.name, email: session.user.email }
}

// Cookie 配置
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
