import { NextResponse } from 'next/server'
import { getSurpriseArticles } from '@/lib/feed'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') ?? '10', 10)

    const articles = await getSurpriseArticles(limit)
    return NextResponse.json(articles)
  } catch (error) {
    console.error('Surprise API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch surprise articles' },
      { status: 500 }
    )
  }
}
