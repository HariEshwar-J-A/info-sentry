import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUserId } from '@/lib/user'

interface FeedbackBody {
  articleId: string
  type: 'like' | 'dislike'
  topics: string[]
}

export async function POST(request: Request) {
  const auth = await requireUserId()
  if (auth instanceof Response) return auth
  const { userId } = auth
  try {
    const body = (await request.json()) as FeedbackBody
    const { articleId, type, topics } = body

    if (!type || !['like', 'dislike'].includes(type)) {
      return NextResponse.json({ error: 'Invalid feedback type' }, { status: 400 })
    }

    const scoreDelta = type === 'like' ? 0.2 : -0.1
    const signal = type === 'like' ? 'LIKE' : 'DISLIKE'

    // Record feedback in history table
    if (articleId) {
      await prisma.userFeedback.create({
        data: { userId, articleId, signal: signal as 'LIKE' | 'DISLIKE', topics: topics ?? [] },
      }).catch(() => {}) // non-fatal
    }

    // Update interest scores + searchKeywords + lastEngagedAt
    if (topics && topics.length > 0) {
      await Promise.all(
        topics.map(async (topic) => {
          const existing = await prisma.interest.findUnique({
            where: { userId_topic: { userId, topic } },
            select: { id: true, score: true, searchKeywords: true },
          })

          if (existing) {
            const newKeywords = type === 'like'
              ? [...new Set([...existing.searchKeywords, ...topics.filter((t) => t !== topic)])].slice(0, 20)
              : existing.searchKeywords

            await prisma.interest.update({
              where: { userId_topic: { userId, topic } },
              data: {
                score: Math.max(0.1, Math.min(10, existing.score + scoreDelta)),
                searchKeywords: newKeywords,
                lastEngagedAt: new Date(),
              },
            })
          } else if (type === 'like') {
            await prisma.interest.create({
              data: {
                userId,
                topic,
                score: 1.0 + scoreDelta,
                isActive: true,
                searchKeywords: topics.filter((t) => t !== topic).slice(0, 10),
                lastEngagedAt: new Date(),
              },
            })
          }
        })
      )
    }

    // Store explicit sentiment in ArticleInsight
    if (articleId) {
      try {
        await prisma.articleInsight.upsert({
          where: { articleId },
          create: {
            articleId,
            userId,
            userSentiment: type === 'like' ? 'positive' : 'negative',
            keywords: topics,
          },
          update: {
            userSentiment: type === 'like' ? 'positive' : 'negative',
            updatedAt: new Date(),
          },
        })
      } catch {
        // Non-fatal — insight is best-effort
      }
    }

    return NextResponse.json({ success: true, delta: scoreDelta })
  } catch (error) {
    console.error('Feedback API error:', error)
    return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 })
  }
}
