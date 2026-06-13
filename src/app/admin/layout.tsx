import { redirect } from 'next/navigation'
import { isLoggedIn, getCurrentUser } from '@/lib/auth'
import { AdminLayoutClient } from './AdminLayoutClient'
import { Toaster } from "@/registry/new-york/ui/toaster"
import { Metadata } from 'next'

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
  const logged = await isLoggedIn()
  if (!logged) {
    redirect('/auth/signin')
  }

  const user = await getCurrentUser()

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
