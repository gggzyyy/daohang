import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import type { DefaultSession, NextAuthConfig } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      accessToken?: string
    } & DefaultSession['user']
  }
  interface JWT {
    accessToken?: string
  }
  interface User {
    accessToken?: string
  }
}

// 安全地解析 secret：按优先级
function resolveSecret(): string {
  if (process.env.NEXTAUTH_SECRET) return process.env.NEXTAUTH_SECRET
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET
  if (process.env.GITHUB_CLIENT_SECRET) return process.env.GITHUB_CLIENT_SECRET
  return 'fallback-nextauth-secret-please-set-in-vercel'
}

const providers = [
  CredentialsProvider({
    name: '管理员登录',
    credentials: {
      username: { label: '用户名', type: 'text' },
      password: { label: '密码', type: 'password' },
    },
    async authorize(credentials) {
      // 从环境变量读取管理员账号密码
      // 优先用 ADMIN_USERNAME / ADMIN_PASSWORD，其次用 GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET 作为备选
      const validUsername = process.env.ADMIN_USERNAME || process.env.GITHUB_CLIENT_ID || 'admin'
      const validPassword = process.env.ADMIN_PASSWORD || process.env.GITHUB_CLIENT_SECRET || 'admin123'

      if (
        credentials?.username === validUsername &&
        credentials?.password === validPassword
      ) {
        return {
          id: 'admin',
          name: '管理员',
          email: 'admin@navsphere.local',
          image: undefined,
        }
      }

      return null
    },
  }),
]

const config = {
  providers,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.accessToken = 'admin-session'
      }
      return token
    },
    async session({ session, token }) {
      if (session?.user) {
        session.user.accessToken = token.accessToken as string
      }
      return session
    }
  },
  pages: {
    signIn: '/auth/signin'
  },
  secret: resolveSecret(),
  session: {
    strategy: 'jwt'
  },
  trustHost: true,
  debug: process.env.NODE_ENV === 'development'
} satisfies NextAuthConfig

const handler = NextAuth(config)

export const auth = handler.auth
export const { handlers: { GET, POST } } = handler
