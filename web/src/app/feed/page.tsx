import { Suspense } from 'react'
import { TopBar } from '@/components/shell/TopBar'
import { FeedClient } from '@/components/feed/FeedClient'
import { getFeedArticles, type ArticleWithSummary } from '@/lib/feed'
import { SourceTypeToggle } from '@/components/shell/SourceTypeToggle'
import { getUserId } from '@/lib/user'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function FeedPage() {
  let articles: ArticleWithSummary[] = []
  try {
    const userId = await getUserId() ?? undefined
    articles = await getFeedArticles(userId ? { userId } : undefined)
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
