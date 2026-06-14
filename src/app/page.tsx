import { NavigationContent } from '@/components/navigation-content'
import { Metadata } from 'next/types'
import { ScrollToTop } from '@/components/ScrollToTop'
import { Container } from '@/components/ui/container'
import type { SiteConfig } from '@/types/site'

export const dynamic = 'force-dynamic'

async function getData() {
  const navRes = await fetch('https://9277277.xyz/api/home/navigation', { cache: 'no-store' })
  const siteRes = await fetch('https://9277277.xyz/api/home/site', { cache: 'no-store' })
  const [navigationData, siteData] = await Promise.all([
    navRes.json(),
    siteRes.json()
  ])
  return { navigationData, siteData }
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
