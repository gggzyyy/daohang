import { auth } from '@/lib/auth'
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
  let session = null
  try {
    session = await auth()
  } catch (e) {
    console.error('Auth error:', e)
  }

  return (
    <>
      <AdminLayoutClient
        user={session?.user ? {
          name: session.user.name,
          email: session.user.email,
          image: session.user.image
        } : null}
      >
        {children}
      </AdminLayoutClient>
      <Toaster />
    </>
  )
}