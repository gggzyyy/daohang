import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { COOKIE_NAME, verifySessionCookie } from '@/lib/auth'

export async function middleware(request: NextRequest) {
  // 只对 /admin 路径保护
  if (request.nextUrl.pathname.startsWith('/admin')) {
    const cookie = request.cookies.get(COOKIE_NAME)?.value

    if (!cookie) {
      return NextResponse.redirect(
        new URL('/auth/signin', request.url)
      )
    }

    try {
      const valid = await verifySessionCookie(cookie)
      if (!valid) {
        const response = NextResponse.redirect(
          new URL('/auth/signin', request.url)
        )
        response.cookies.set({
          name: COOKIE_NAME,
          value: '',
          maxAge: 0,
          path: '/',
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
        })
        return response
      }
    } catch {
      return NextResponse.redirect(
        new URL('/auth/signin', request.url)
      )
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}
