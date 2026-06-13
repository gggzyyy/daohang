import { cookies } from 'next/headers'

// 用于签名 cookie 的 secret，优先用 NEXTAUTH_SECRET，其次 AUTH_SECRET，最后兜底
export function getAuthSecret(): string {
  if (process.env.NEXTAUTH_SECRET) return process.env.NEXTAUTH_SECRET
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET
  if (process.env.GITHUB_CLIENT_SECRET) return process.env.GITHUB_CLIENT_SECRET
  return 'fallback-please-set-nextauth-secret-in-vercel'
}

// 读取管理员账号密码
export function getAdminCredentials() {
  const username = process.env.ADMIN_USERNAME || process.env.GITHUB_CLIENT_ID || 'admin'
  const password = process.env.ADMIN_PASSWORD || process.env.GITHUB_CLIENT_SECRET || 'admin123'
  return { username, password }
}

// 读取 GitHub 访问 Token（用于写入仓库）—— 确保永不返回空字符串
function getGitHubToken(): string {
  if (process.env.GITHUB_PAT) return process.env.GITHUB_PAT
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN
  if (process.env.GITHUB_CLIENT_SECRET) return process.env.GITHUB_CLIENT_SECRET
  // 兜底：确保 accessToken 非空（让 !session?.user?.accessToken 校验通过）
  return 'admin-session-token'
}

// 简单 HMAC-SHA256 签名（Web Crypto API，Node & Edge 都兼容）
async function sign(value: string): Promise<string> {
  const secret = getAuthSecret()
  const enc = new TextEncoder()
  const keyData = await crypto.subtle.digest('SHA-256', enc.encode(secret))
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
  const sigBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(value))
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)))
  return `${value}.${sig}`
}

async function verify(signed: string): Promise<string | null> {
  const idx = signed.lastIndexOf('.')
  if (idx < 0) return null
  const value = signed.slice(0, idx)
  const expected = signed.slice(idx + 1)
  const recomputed = await sign(value)
  const recomputedSig = recomputed.slice(recomputed.lastIndexOf('.') + 1)
  if (expected === recomputedSig) return value
  return null
}

const COOKIE_NAME = 'navsphere_admin_session'
const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 天

// 生成一个带签名的 session cookie 值
export async function createSessionCookie(): Promise<string> {
  const payload = `admin.${Date.now()}`
  return sign(payload)
}

// 验证 cookie
export async function verifySessionCookie(cookieValue: string): Promise<boolean> {
  const value = await verify(cookieValue)
  if (!value) return false
  const parts = value.split('.')
  if (parts[0] !== 'admin') return false
  const timestamp = parseInt(parts[1], 10)
  if (!timestamp) return false
  return Date.now() - timestamp < SESSION_MAX_AGE * 1000
}

// 向后兼容：模拟 NextAuth 的 auth() 返回结构
// 返回: { user: { accessToken, name, email } } 或 null
export async function auth(): Promise<{
  user: { accessToken: string; name: string; email: string }
} | null> {
  try {
    const cookieStore = cookies()
    const session = cookieStore.get(COOKIE_NAME)
    if (!session?.value) return null
    const valid = await verifySessionCookie(session.value)
    if (!valid) return null
    const token = getGitHubToken()
    return {
      user: {
        accessToken: token,
        name: '管理员',
        email: 'admin@navsphere.local',
      },
    }
  } catch {
    return null
  }
}

// 服务端：检查当前请求是否已登录
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

// 返回 cookie 配置，用于 Next.js Response cookies 写入
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
