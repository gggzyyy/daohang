import { NextResponse } from 'next/server'

export async function GET() {
  const check = (name: string) => {
    const val = process.env[name]
    if (!val) return { set: false }
    const prefix = val.slice(0, 4)
    const suffix = val.slice(-3)
    return { set: true, hint: `${prefix}...${suffix}` }
  }

  return NextResponse.json({
    time: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    runtime: 'node',
    auth_type: 'password (credentials)',
    vars: {
      NEXTAUTH_SECRET: check('NEXTAUTH_SECRET'),
      AUTH_SECRET: check('AUTH_SECRET'),
      NEXTAUTH_URL: check('NEXTAUTH_URL'),
      ADMIN_USERNAME: check('ADMIN_USERNAME'),
      ADMIN_PASSWORD: check('ADMIN_PASSWORD'),
      GITHUB_CLIENT_ID: check('GITHUB_CLIENT_ID'),
      GITHUB_CLIENT_SECRET: check('GITHUB_CLIENT_SECRET'),
    },
    effective: {
      username_source: process.env.ADMIN_USERNAME ? 'ADMIN_USERNAME' : (process.env.GITHUB_CLIENT_ID ? 'GITHUB_CLIENT_ID (fallback)' : 'default "admin"'),
      password_source: process.env.ADMIN_PASSWORD ? 'ADMIN_PASSWORD' : (process.env.GITHUB_CLIENT_SECRET ? 'GITHUB_CLIENT_SECRET (fallback)' : 'default "admin123"'),
      secret_source: process.env.NEXTAUTH_SECRET ? 'NEXTAUTH_SECRET' : (process.env.AUTH_SECRET ? 'AUTH_SECRET' : (process.env.GITHUB_CLIENT_SECRET ? 'GITHUB_CLIENT_SECRET (fallback)' : 'hardcoded fallback')),
    },
  })
}
