import { NextResponse } from 'next/server'
import { getFeedArticles } from '@/lib/feed'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const hours = parseInt(url.searchParams.get('hours') ?? '48', 10)
    const topic = url.searchParams.get('topic') ?? undefined
    const minRelevance = parseFloat(url.searchParams.get('minRelevance') ?? '0')

    const articles = await getFeedArticles({ hours, topic, minRelevance })
    return NextResponse.json(articles)
  } catch (error) {
    console.error('Feed API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch feed' },
      { status: 500 }
    )
  }
}
