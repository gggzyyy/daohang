import { NavigationContent } from '@/components/navigation-content'
import { Metadata } from 'next/types'
import { ScrollToTop } from '@/components/ScrollToTop'
import { Container } from '@/components/ui/container'
import type { SiteConfig } from '@/types/site'
import navigationData from '@/navsphere/content/navigation.json'
import siteDataRaw from '@/navsphere/content/site.json'
import { getProcessedData } from '@/lib/data-loader'

export const revalidate = 10

const BASE = process.env.VERCEL_URL 
  ? `https://${process.env.VERCEL_URL}` 
  : process.env.NEXT_PUBLIC_VERCEL_URL 
    ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
    : ''

async function getData() {
  // 构建时使用静态导入
  if (!BASE) {
    return getProcessedData(navigationData, siteDataRaw)
  }
  // 运行时始终从 API 获取最新数据（ISR 每10秒刷新）
  try {
    const [navData, siteInfo] = await Promise.all([
      fetch(`${BASE}/api/home/navigation`, { next: { revalidate: 10 } }),
      fetch(`${BASE}/api/home/site`, { next: { revalidate: 10 } })
    ])
    if (!navData.ok || !siteInfo.ok) throw new Error('API not ready')
    const [liveNav, liveSite] = await Promise.all([
      navData.json(),
      siteInfo.json()
    ])
    return { navigationData: liveNav, siteData: liveSite }
  } catch {
    return getProcessedData(navigationData, siteDataRaw)
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const { siteData } = await getData()

  return {
    title: siteData.basic.title,
    description: siteData.basic.description,
    keywords: siteData.basic.keywords,
    icons: {
      icon: siteData.appearance.favicon,
    },
  }
}

export default async function HomePage() {
  const { navigationData, siteData } = await getData()

  return (
    <Container>
      <NavigationContent navigationData={navigationData} siteData={siteData} />
      <ScrollToTop />
    </Container>
  )
}
