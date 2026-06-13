import { NextResponse } from 'next/server'
import { getAuthSecret, getAdminCredentials } from '@/lib/auth'

export async function GET() {
  const secret = getAuthSecret()
  const creds = getAdminCredentials()

  return NextResponse.json({
    time: new Date().toISOString(),
    auth_type: 'password (signed cookie)',
    secret: {
      hint: `${secret.slice(0, 4)}...${secret.slice(-3)}`,
      length: secret.length,
    },
    admin: {
      username_hint: `${creds.username.slice(0, 2)}...(${creds.username.length} chars)`,
      password_hint: `...${creds.password.slice(-3)} (${creds.password.length} chars)`,
    },
    note: '若变量未配置，会自动使用 GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET 作为备选的用户名/密码',
  })
}
