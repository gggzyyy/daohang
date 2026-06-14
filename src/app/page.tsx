import { NavigationContent } from '@/components/navigation-content'
import { Metadata } from 'next/types'
import { ScrollToTop } from '@/components/ScrollToTop'
import { Container } from '@/components/ui/container'
import type { SiteConfig } from '@/types/site'
import { getProcessedData } from '@/lib/data-loader'

export const revalidate = 60

const BASE = process.env.VERCEL_URL 
  ? `https://${process.env.VERCEL_URL}` 
  : 'http://localhost:3000'

async function getData() {
  const [navRes, siteRes] = await Promise.all([
    fetch(`${BASE}/api/home/navigation`, { next: { revalidate: 60 } }),
    fetch(`${BASE}/api/home/site`, { next: { revalidate: 60 } })
  ])
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
