import { NextResponse } from 'next/server'
import { getFeedArticles, getBookmarkedArticles, searchArticlesByAI } from '@/lib/feed'
import { requireUserId } from '@/lib/user'

export async function GET(request: Request) {
  const auth = await requireUserId()
  if (auth instanceof Response) return auth
  const { userId } = auth
  try {
    const url = new URL(request.url)
    const filter = url.searchParams.get('filter')

    if (filter === 'bookmarked') {
      const articles = await getBookmarkedArticles(userId)
      return NextResponse.json(articles)
    }

    const hoursParam = url.searchParams.get('hours')
    const hours = hoursParam !== null ? parseInt(hoursParam, 10) : undefined
    const topic = url.searchParams.get('topic') ?? undefined
    const minRelevance = parseFloat(url.searchParams.get('minRelevance') ?? '0')
    const keyword = url.searchParams.get('keyword') ?? undefined
    const sort = (url.searchParams.get('sort') ?? 'relevance') as 'relevance' | 'date' | 'sentiment'
    const sentimentMin = url.searchParams.get('sentimentMin') ? parseFloat(url.searchParams.get('sentimentMin')!) : undefined
    const sentimentMax = url.searchParams.get('sentimentMax') ? parseFloat(url.searchParams.get('sentimentMax')!) : undefined
    const dateFrom = url.searchParams.get('dateFrom') ? new Date(url.searchParams.get('dateFrom')!) : undefined
    const dateTo = url.searchParams.get('dateTo') ? new Date(url.searchParams.get('dateTo')!) : undefined
    const aiQuery = url.searchParams.get('aiQuery') ?? undefined

    if (aiQuery) {
      const articles = await searchArticlesByAI(aiQuery, userId)
      return NextResponse.json(articles)
    }

    const articles = await getFeedArticles({ userId, hours, topic, minRelevance, keyword, sort, sentimentMin, sentimentMax, dateFrom, dateTo })
    return NextResponse.json(articles)
  } catch (error) {
    console.error('Feed API error:', error)
    return NextResponse.json({ error: 'Failed to fetch feed' }, { status: 500 })
  }
}
