import { TopBar } from '@/components/shell/TopBar'
import { FeedClient } from '@/components/feed/FeedClient'
import { getFeedArticles, type ArticleWithSummary } from '@/lib/feed'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function FeedPage() {
  let articles: ArticleWithSummary[] = []
  try {
    articles = await getFeedArticles({ hours: 48 })
  } catch (err) {
    console.error('Feed fetch error:', err)
  }

  const subtitle = `${articles.length} articles in the last 48 hours`

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
      <TopBar title="Feed" subtitle={subtitle} />
      <FeedClient articles={articles} />
    </div>
  )
}
