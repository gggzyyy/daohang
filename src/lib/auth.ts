// 简单的账号密码登录系统
// session cookie 格式: admin.${timestamp}.${signature}
// 不依赖任何外部 API，纯字符串操作，100% 跨环境兼容

const COOKIE_NAME = 'navsphere_admin_session'
const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 天
const SIGNATURE_LEN = 16 // hex 16 位

// ============ 轻量签名（不依赖 crypto API，纯字符串操作） ============

function stringToHash(str: string): string {
  // 基于 FNV-1a 变种的简单哈希
  let h1 = 0xdeadbeef ^ 0x9e3779b9
  let h2 = 0x41c6ce57 ^ 0x85ebca6b
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 0x85ebca77)
    h2 = Math.imul(h2 ^ ch, 0xc2b2ae35)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 0x7feb352d)
  h2 = Math.imul(h2 ^ (h2 >>> 13), 0x3f841597)
  h1 = Math.imul(h1 ^ (h1 >>> 16), 0x24d8a8e9)
  h2 = Math.imul(h2 ^ (h2 >>> 13), 0x1a31a385)
  const s1 = (h1 >>> 0).toString(16).padStart(8, '0')
  const s2 = (h2 >>> 0).toString(16).padStart(8, '0')
  return s1 + s2
}

function sign(message: string, secret: string): string {
  const h1 = stringToHash(message + '|' + secret)
  const h2 = stringToHash(secret + '|' + message)
  // 交替取字符生成更强的签名
  let result = ''
  for (let i = 0; i < SIGNATURE_LEN; i++) {
    result += (i % 2 === 0 ? h1[i % h1.length] : h2[i % h2.length])
  }
  return result
}

function verifySignature(message: string, sig: string, secret: string): boolean {
  if (!sig || sig.length !== SIGNATURE_LEN) return false
  const expected = sign(message, secret)
  return expected === sig
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

// ============ Session API ============

// 创建 session cookie 值: admin.${timestamp}.${signature}
export function createSessionCookie(): string {
  const timestamp = Date.now().toString()
  const payload = 'admin.' + timestamp
  const secret = getAuthSecret()
  const signature = sign(payload, secret)
  return payload + '.' + signature
}

// 校验 session cookie
export function verifySessionCookie(cookieValue: string): boolean {
  if (!cookieValue) return false
  const parts = cookieValue.split('.')
  // admin.${timestamp}.${signature}
  if (parts.length !== 3) return false
  if (parts[0] !== 'admin') return false

  const timestamp = parseInt(parts[1], 10)
  if (!timestamp) return false
  if (Date.now() - timestamp >= SESSION_MAX_AGE * 1000) return false

  const signature = parts[2]
  const payload = 'admin.' + parts[1]
  const secret = getAuthSecret()
  return verifySignature(payload, signature, secret)
}

// ============ 对外 API ============

export function auth(
  source?: string | Request | Headers | null
): {
  user: { accessToken: string; name: string; email: string }
} | null {
  try {
    const cookieValue = extractSessionCookie(source)
    if (!cookieValue) return null
    const valid = verifySessionCookie(cookieValue)
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

export function isLoggedIn(
  source?: string | Request | Headers | null
): boolean {
  return auth(source) !== null
}

export function getCurrentUser(
  source?: string | Request | Headers | null
): { name: string; email: string } | null {
  const session = auth(source)
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
