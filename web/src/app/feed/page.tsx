import { Suspense } from 'react'
import { TopBar } from '@/components/shell/TopBar'
import { FeedClient } from '@/components/feed/FeedClient'
import { getFeedArticles, getActiveInterests, type ArticleWithSummary } from '@/lib/feed'
import { SourceTypeToggle } from '@/components/shell/SourceTypeToggle'
import { getUserId } from '@/lib/user'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function FeedPage() {
  let articles: ArticleWithSummary[] = []
  let userTopics: string[] = []
  try {
    const userId = await getUserId() ?? undefined
    const [feedArticles, interests] = await Promise.all([
      getFeedArticles(userId ? { userId } : undefined),
      userId ? getActiveInterests(userId) : Promise.resolve([]),
    ])
    articles = feedArticles
    userTopics = interests.map((i) => i.topic)
  } catch (err) {
    console.error('Feed fetch error:', err)
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
      <TopBar
        title="iFeeds"
        subtitle={`${articles.length} articles`}
        actions={<SourceTypeToggle active="news" />}
      />
      <Suspense>
        <FeedClient articles={articles} userTopics={userTopics} />
      </Suspense>
    </div>
  )
}
