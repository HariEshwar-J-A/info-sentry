import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUserId } from '@/lib/user'

interface BookmarkBody {
  articleId: string
  bookmarked: boolean
  topics?: string[]
}

export async function POST(request: Request) {
  const auth = await requireUserId()
  if (auth instanceof Response) return auth
  const { userId } = auth

  try {
    const { articleId, bookmarked, topics = [] } = (await request.json()) as BookmarkBody

    if (!articleId) return NextResponse.json({ error: 'articleId required' }, { status: 400 })

    const now = bookmarked ? new Date() : null

    await prisma.articleInsight.upsert({
      where: { articleId },
      create: { articleId, userId, bookmarkedAt: now, keywords: topics },
      update: { bookmarkedAt: now, updatedAt: new Date() },
    })

    // Record in feedback history
    await prisma.userFeedback.create({
      data: {
        userId,
        articleId,
        signal: bookmarked ? 'BOOKMARK' : 'UNBOOKMARK',
        topics,
      },
    }).catch(() => {})

    return NextResponse.json({ bookmarked, articleId })
  } catch (error) {
    console.error('Bookmark API error:', error)
    return NextResponse.json({ error: 'Failed to toggle bookmark' }, { status: 500 })
  }
}
