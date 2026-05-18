import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUserId } from '@/lib/user'

// Returns up to 3 topics appearing frequently in recent articles
// but not yet tracked by the user. Used for "you might want to track X" nudges.
export async function GET() {
  const auth = await requireUserId()
  if (auth instanceof Response) return auth
  const { userId } = auth

  const since = new Date(Date.now() - 72 * 60 * 60 * 1000)

  const [summaries, interests] = await Promise.all([
    prisma.summary.findMany({
      where: { article: { scrapedAt: { gte: since }, status: { in: ['SUMMARIZED', 'POSTED'] } } },
      select: { keyTopics: true },
      take: 300,
    }),
    prisma.interest.findMany({
      where: { userId, isActive: true },
      select: { topic: true },
    }),
  ])

  const userTopicSet = new Set(interests.map(i => i.topic.toLowerCase()))

  const topicCount = new Map<string, number>()
  for (const s of summaries) {
    for (const t of s.keyTopics) {
      const lower = t.toLowerCase()
      if (!userTopicSet.has(lower) && t.length > 2 && t.length < 40) {
        topicCount.set(t, (topicCount.get(t) ?? 0) + 1)
      }
    }
  }

  const suggestions = Array.from(topicCount.entries())
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([topic, count]) => ({ topic, count }))

  return NextResponse.json(suggestions)
}
