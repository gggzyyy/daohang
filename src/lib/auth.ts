import NextAuth from 'next-auth'
import GithubProvider from 'next-auth/providers/github'
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
// 1) NEXTAUTH_SECRET  2) AUTH_SECRET  3) GITHUB_CLIENT_SECRET  4) 兜底字符串
function resolveSecret(): string {
  if (process.env.NEXTAUTH_SECRET) return process.env.NEXTAUTH_SECRET
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET
  if (process.env.GITHUB_CLIENT_SECRET) return process.env.GITHUB_CLIENT_SECRET
  return 'please-set-nextauth-secret-in-vercel'
}

const providers = []

if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  providers.push(
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      authorization: {
        params: { scope: 'repo' }
      },
      // 不依赖 NEXTAUTH_URL，callback URL 由 NextAuth 从请求自动推断
      checks: ['state']
    })
  )
}

const config = {
  providers,
  callbacks: {
    async jwt({ token, account }) {
      if (account?.access_token) {
        token.accessToken = account.access_token
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