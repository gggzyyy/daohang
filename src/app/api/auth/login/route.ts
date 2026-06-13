import { NextResponse } from 'next/server'
import {
  getAdminCredentials,
  createSessionCookie,
  getCookieConfig,
} from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { username, password } = body

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: '请输入用户名和密码' },
        { status: 400 }
      )
    }

    const { username: validUsername, password: validPassword } = getAdminCredentials()

    if (username !== validUsername || password !== validPassword) {
      return NextResponse.json(
        { success: false, error: '用户名或密码错误' },
        { status: 401 }
      )
    }

    const cookieValue = await createSessionCookie()
    const cfg = getCookieConfig()

    const response = NextResponse.json({ success: true })
    response.cookies.set({
      name: cfg.name,
      value: cookieValue,
      maxAge: cfg.maxAge,
      path: cfg.path,
      httpOnly: cfg.httpOnly,
      secure: cfg.secure,
      sameSite: cfg.sameSite,
    })
    return response
  } catch (error) {
    console.error('[auth/login] error:', error)
    return NextResponse.json(
      { success: false, error: '服务器错误，请稍后重试' },
      { status: 500 }
    )
  }
}
