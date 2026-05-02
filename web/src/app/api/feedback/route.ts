import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { OWNER_USER_ID } from '@/lib/user'

interface FeedbackBody {
  articleId: string
  type: 'like' | 'dislike'
  topics: string[]
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as FeedbackBody
    const { articleId: _articleId, type, topics } = body

    if (!type || !['like', 'dislike'].includes(type)) {
      return NextResponse.json({ error: 'Invalid feedback type' }, { status: 400 })
    }

    const scoreDelta = type === 'like' ? 0.2 : -0.1

    // Update interest scores for each topic in the article
    if (topics && topics.length > 0) {
      await Promise.all(
        topics.map(async (topic) => {
          const existing = await prisma.interest.findUnique({
            where: { userId_topic: { userId: OWNER_USER_ID, topic } },
          })

          if (existing) {
            await prisma.interest.update({
              where: { userId_topic: { userId: OWNER_USER_ID, topic } },
              data: {
                score: Math.max(0.1, Math.min(10, existing.score + scoreDelta)),
              },
            })
          } else if (type === 'like') {
            // Create new interest when explicitly liked
            await prisma.interest.create({
              data: {
                userId: OWNER_USER_ID,
                topic,
                score: 1.0 + scoreDelta,
                isActive: true,
              },
            })
          }
        })
      )
    }

    return NextResponse.json({ success: true, delta: scoreDelta })
  } catch (error) {
    console.error('Feedback API error:', error)
    return NextResponse.json(
      { error: 'Failed to save feedback' },
      { status: 500 }
    )
  }
}
