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

// 安全地解析 secret：NEXTAUTH_SECRET 优先，其次 GITHUB_CLIENT_SECRET，
// 若两者都没有则用一个固定的 fallback（生产环境应必须设置 NEXTAUTH_SECRET）
function resolveSecret(): string {
  if (process.env.NEXTAUTH_SECRET) return process.env.NEXTAUTH_SECRET
  if (process.env.GITHUB_CLIENT_SECRET) return process.env.GITHUB_CLIENT_SECRET
  // 最后的兜底：NextAuth 只要有非空字符串就不会直接 500
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
      }
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