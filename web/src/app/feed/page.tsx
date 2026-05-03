import { Suspense } from 'react'
import { TopBar } from '@/components/shell/TopBar'
import { FeedClient } from '@/components/feed/FeedClient'
import { getFeedArticles, type ArticleWithSummary } from '@/lib/feed'
import { SourceTypeToggle } from '@/components/shell/SourceTypeToggle'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function FeedPage() {
  let articles: ArticleWithSummary[] = []
  try {
    articles = await getFeedArticles()
  } catch (err) {
    console.error('Feed fetch error:', err)
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
      <TopBar
        title="Feed"
        subtitle={`${articles.length} articles`}
        actions={<SourceTypeToggle active="news" />}
      />
      <Suspense>
        <FeedClient articles={articles} />
      </Suspense>
    </div>
  )
}
