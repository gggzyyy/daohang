import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/admin')) {
    try {
      const session = await auth()
      if (!session?.user) {
        const callbackUrl = request.url
        return NextResponse.redirect(
          new URL(`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`, request.url)
        )
      }
    } catch (e) {
      // If auth fails on edge, redirect to signin anyway
      return NextResponse.redirect(
        new URL(`/auth/signin?callbackUrl=${encodeURIComponent(request.url)}`, request.url)
      )
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*']
}