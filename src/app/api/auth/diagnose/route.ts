import { NextResponse } from 'next/server'
import { getAuthSecret, getAdminCredentials } from '@/lib/auth'

export async function GET() {
  const secret = getAuthSecret()
  const creds = getAdminCredentials()

  const vars = {
    NEXTAUTH_SECRET: { set: !!process.env.NEXTAUTH_SECRET },
    AUTH_SECRET: { set: !!process.env.AUTH_SECRET },
    NEXTAUTH_URL: { set: !!process.env.NEXTAUTH_URL, hint: process.env.NEXTAUTH_URL ? `${process.env.NEXTAUTH_URL.slice(0, 8)}...` : '' },
    ADMIN_USERNAME: { set: !!process.env.ADMIN_USERNAME, hint: process.env.ADMIN_USERNAME ? `${process.env.ADMIN_USERNAME.slice(0, 4)}...` : '' },
    ADMIN_PASSWORD: { set: !!process.env.ADMIN_PASSWORD, hint: process.env.ADMIN_PASSWORD ? `...${process.env.ADMIN_PASSWORD.slice(-3)}` : '' },
    GITHUB_PAT: { set: !!process.env.GITHUB_PAT, hint: process.env.GITHUB_PAT ? `${process.env.GITHUB_PAT.slice(0, 4)}...${process.env.GITHUB_PAT.slice(-3)}` : '' },
    GITHUB_CLIENT_ID: { set: !!process.env.GITHUB_CLIENT_ID, hint: process.env.GITHUB_CLIENT_ID ? `${process.env.GITHUB_CLIENT_ID.slice(0, 4)}...` : '' },
    GITHUB_CLIENT_SECRET: { set: !!process.env.GITHUB_CLIENT_SECRET, hint: process.env.GITHUB_CLIENT_SECRET ? `...${process.env.GITHUB_CLIENT_SECRET.slice(-3)}` : '' },
    GITHUB_OWNER: { set: !!process.env.GITHUB_OWNER },
    GITHUB_REPO: { set: !!process.env.GITHUB_REPO },
    GITHUB_BRANCH: { set: !!process.env.GITHUB_BRANCH },
  }

  return NextResponse.json({
    time: new Date().toISOString(),
    auth_type: 'password (signed cookie)',
    effective: {
      effective_secret: `${secret.slice(0, 4)}...${secret.slice(-3)}`,
      effective_username: creds.username === process.env.ADMIN_USERNAME ? 'ADMIN_USERNAME'
        : creds.username === process.env.GITHUB_CLIENT_ID ? 'GITHUB_CLIENT_ID (fallback)'
          : 'default "admin"',
      effective_password: creds.password === process.env.ADMIN_PASSWORD ? 'ADMIN_PASSWORD'
        : creds.password === process.env.GITHUB_CLIENT_SECRET ? 'GITHUB_CLIENT_SECRET (fallback)'
          : 'default "admin123"',
    },
    vars,
  })
}
