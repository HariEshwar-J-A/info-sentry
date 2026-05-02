import { NextResponse } from 'next/server'
import { getTopicClusters } from '@/lib/feed'

export async function GET() {
  try {
    const clusters = await getTopicClusters()
    return NextResponse.json(clusters)
  } catch (error) {
    console.error('Topics API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch topic clusters' },
      { status: 500 }
    )
  }
}
