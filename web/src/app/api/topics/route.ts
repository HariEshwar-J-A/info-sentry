import { NextResponse } from 'next/server'
import { getTopicClusters } from '@/lib/feed'
import { requireUserId } from '@/lib/user'

export async function GET(req: Request) {
  const auth = await requireUserId()
  if (auth instanceof Response) return auth
  const { userId } = auth
  try {
    const clusters = await getTopicClusters(userId)
    return NextResponse.json(clusters)
  } catch (error) {
    console.error('Topics API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch topic clusters' },
      { status: 500 }
    )
  }
}
