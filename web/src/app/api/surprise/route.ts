import { NextResponse } from 'next/server'
import { getSurpriseArticles } from '@/lib/feed'
import { requireUserId } from '@/lib/user'

export async function GET(request: Request) {
  const auth = await requireUserId()
  if (auth instanceof Response) return auth
  const { userId } = auth
  try {
    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') ?? '10', 10)

    const articles = await getSurpriseArticles(limit, userId)
    return NextResponse.json(articles)
  } catch (error) {
    console.error('Surprise API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch surprise articles' },
      { status: 500 }
    )
  }
}
