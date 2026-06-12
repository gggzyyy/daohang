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
    vars: {
      NEXTAUTH_SECRET: check('NEXTAUTH_SECRET'),
      AUTH_SECRET: check('AUTH_SECRET'),
      NEXTAUTH_URL: check('NEXTAUTH_URL'),
      GITHUB_CLIENT_ID: check('GITHUB_CLIENT_ID'),
      GITHUB_CLIENT_SECRET: check('GITHUB_CLIENT_SECRET'),
    },
    effective_secret: {
      from_nextauth: !!process.env.NEXTAUTH_SECRET,
      from_auth: !process.env.NEXTAUTH_SECRET && !!process.env.AUTH_SECRET,
      from_github: !process.env.NEXTAUTH_SECRET && !process.env.AUTH_SECRET && !!process.env.GITHUB_CLIENT_SECRET,
      fallback: !process.env.NEXTAUTH_SECRET && !process.env.AUTH_SECRET && !process.env.GITHUB_CLIENT_SECRET,
    },
  })
}
