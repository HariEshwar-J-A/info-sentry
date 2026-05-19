import { prisma } from '@/lib/prisma'
import { requireUserId } from '@/lib/user'
import { predictionVisibilityWhere } from '@/lib/predictions'

export async function GET() {
  const auth = await requireUserId()
  if (auth instanceof Response) return auth
  const { userId } = auth

  try {
    const groups = await prisma.prediction.groupBy({
      by: ['status'],
      where: predictionVisibilityWhere(userId),
      _count: { _all: true },
    })

    const counts: Record<string, number> = {
      PENDING: 0,
      CORRECT: 0,
      INCORRECT: 0,
      PARTIALLY_CORRECT: 0,
      EXPIRED: 0,
    }

    for (const g of groups) {
      counts[g.status] = g._count._all
    }

    return Response.json(counts)
  } catch (err) {
    console.error('Prediction counts error:', err)
    return Response.json({}, { status: 500 })
  }
}
