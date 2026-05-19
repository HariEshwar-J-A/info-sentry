import { prisma } from '@/lib/prisma'
import { requireUserId } from '@/lib/user'
import { predictionVisibilityWhere } from '@/lib/predictions'

export async function GET() {
  const auth = await requireUserId()
  if (auth instanceof Response) return auth
  const { userId } = auth

  try {
    const resolved = await prisma.prediction.findMany({
      where: {
        AND: [
          predictionVisibilityWhere(userId),
          { status: { in: ['CORRECT', 'INCORRECT', 'PARTIALLY_CORRECT'] } },
        ],
      },
      include: {
        article: {
          include: { summary: { select: { keyTopics: true } } },
        },
      },
    })

    const total = resolved.length
    const correct = resolved.filter((p) => p.status === 'CORRECT').length
    const incorrect = resolved.filter((p) => p.status === 'INCORRECT').length
    const partial = resolved.filter((p) => p.status === 'PARTIALLY_CORRECT').length
    const accuracyRate = total > 0 ? (correct + partial * 0.5) / total : 0

    // Streak: consecutive correct/partial from most recent
    const chronological = [...resolved].sort((a, b) =>
      new Date(b.resolvedAt ?? b.createdAt).getTime() - new Date(a.resolvedAt ?? a.createdAt).getTime()
    )
    let currentStreak = 0
    let bestStreak = 0
    let streak = 0
    for (const p of chronological) {
      if (p.status === 'CORRECT' || p.status === 'PARTIALLY_CORRECT') {
        streak++
        if (streak > bestStreak) bestStreak = streak
        if (currentStreak === 0 || streak <= currentStreak) currentStreak = streak
      } else {
        if (currentStreak === 0) currentStreak = 0
        streak = 0
      }
    }
    // current streak = streak from the newest resolved prediction
    let cs = 0
    for (const p of chronological) {
      if (p.status === 'CORRECT' || p.status === 'PARTIALLY_CORRECT') cs++
      else break
    }
    currentStreak = cs

    // By confidence bucket
    const buckets = [
      { label: '0–50%', min: 0, max: 0.5 },
      { label: '50–70%', min: 0.5, max: 0.7 },
      { label: '70–100%', min: 0.7, max: 1.0 },
    ]

    const byConfidence = buckets.map(({ label, min, max }) => {
      const inBucket = resolved.filter((p) => p.confidence >= min && p.confidence < max)
      const bucketCorrect = inBucket.filter((p) => p.status === 'CORRECT').length
      const bucketPartial = inBucket.filter((p) => p.status === 'PARTIALLY_CORRECT').length
      const rate = inBucket.length > 0 ? (bucketCorrect + bucketPartial * 0.5) / inBucket.length : 0
      return { bucket: label, total: inBucket.length, correct: bucketCorrect, partial: bucketPartial, rate }
    })

    // By topic
    const topicMap = new Map<string, { total: number; correct: number; partial: number }>()
    for (const pred of resolved) {
      const topics = pred.article?.summary?.keyTopics ?? (pred.category ? [pred.category] : [])
      for (const topic of topics) {
        if (!topicMap.has(topic)) topicMap.set(topic, { total: 0, correct: 0, partial: 0 })
        const t = topicMap.get(topic)!
        t.total++
        if (pred.status === 'CORRECT') t.correct++
        if (pred.status === 'PARTIALLY_CORRECT') t.partial++
      }
    }

    const byTopic = Array.from(topicMap.entries())
      .map(([topic, stats]) => ({
        topic,
        total: stats.total,
        correct: stats.correct,
        partial: stats.partial,
        rate: stats.total > 0 ? (stats.correct + stats.partial * 0.5) / stats.total : 0,
      }))
      .filter((t) => t.total >= 2)
      .sort((a, b) => b.total - a.total)
      .slice(0, 15)

    return Response.json({ total, correct, incorrect, partial, accuracyRate, currentStreak, bestStreak, byConfidence, byTopic })
  } catch (err) {
    console.error('Prediction stats error:', err)
    return Response.json({ error: 'Failed to compute stats' }, { status: 500 })
  }
}
