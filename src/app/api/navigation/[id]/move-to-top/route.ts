import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { commitFile, getFileContent, getGitHubToken } from '@/lib/github'
import type { NavigationData } from '@/types/navigation'

export async function POST(
  request: Request,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const { id } = await paramsPromise
  try {
    const session = auth()
    if (!session) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 })
    }

    const data = await getFileContent('src/navsphere/content/navigation.json') as NavigationData
    const items = data.navigationItems || []
    const index = items.findIndex(item => item.id === id)
    if (index === -1) {
      return NextResponse.json({ success: false, error: '分类不存在' }, { status: 404 })
    }
    if (index === 0) {
      return NextResponse.json({ success: false, error: '已在最顶部' }, { status: 400 })
    }

    const [item] = items.splice(index, 1)
    items.splice(index - 1, 0, item)
    data.navigationItems = items

    const token = getGitHubToken()
    await commitFile(
      'src/navsphere/content/navigation.json',
      JSON.stringify(data, null, 2),
      `移动分类 "${item.title}" 到顶部`,
      token
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[move-to-top] error:', error)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
