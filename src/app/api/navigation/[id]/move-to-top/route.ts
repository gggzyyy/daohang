import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { commitFile, getFileContent } from '@/lib/github'
import type { NavigationData } from '@/types/navigation'

export const runtime = 'edge'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session?.user?.accessToken) {
      return new Response('Unauthorized', { status: 401 })
    }

    const id = params.id
    const data = await getFileContent('src/navsphere/content/navigation.json') as NavigationData

    if (!data.navigationItems || !Array.isArray(data.navigationItems)) {
      throw new Error('Invalid navigation data')
    }

    const index = data.navigationItems.findIndex(item => item.id === id)
    if (index === -1) {
      return NextResponse.json({ error: 'Navigation item not found' }, { status: 404 })
    }

    const updatedItems = [...data.navigationItems]
    const [movedItem] = updatedItems.splice(index, 1)
    updatedItems.unshift(movedItem)
    data.navigationItems = updatedItems

    await commitFile(
      'src/navsphere/content/navigation.json',
      JSON.stringify(data, null, 2),
      `Move navigation item ${movedItem.title} to top - ${new Date().toISOString()}`,
      session.user.accessToken
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Move to top error:', error)
    return NextResponse.json({
      error: 'Move failed',
      details: (error as Error).message
    }, { status: 500 })
  }
}
