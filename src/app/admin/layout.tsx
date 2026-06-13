import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { isLoggedIn, getCurrentUser } from '@/lib/auth'
import { AdminLayoutClient } from './AdminLayoutClient'
import { Toaster } from "@/registry/new-york/ui/toaster"
import { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'NavSphere Admin',
  description: 'NavSphere Admin Dashboard',
  icons: {
    icon: '/assets/images/favicon.webp',
    shortcut: '/assets/images/favicon.webp',
    apple: '/assets/images/favicon.webp',
  }
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const h = await headers()
  const cookieHeader = h.get('cookie') || ''

  const logged = isLoggedIn(cookieHeader)
  if (!logged) {
    redirect('/auth/signin')
  }

  const user = getCurrentUser(cookieHeader)

  return (
    <>
      <AdminLayoutClient
        user={{
          name: user?.name || '管理员',
          email: user?.email || 'admin@navsphere.local',
          image: undefined,
        }}
      >
        {children}
      </AdminLayoutClient>
      <Toaster />
    </>
  )
}
