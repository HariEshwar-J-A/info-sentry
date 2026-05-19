import { prisma } from '@/lib/prisma'
import { requireUserId } from '@/lib/user'
import { predictionVisibilityWhere } from '@/lib/predictions'

export async function GET() {
  const auth = await requireUserId()
  if (auth instanceof Response) return auth
  const { userId } = auth

  try {
    const predictions = await prisma.prediction.findMany({
      where: {
        AND: [
          predictionVisibilityWhere(userId),
          { status: { in: ['CORRECT', 'INCORRECT', 'PARTIALLY_CORRECT'] } },
          { resolutionAnalysis: { not: null } },
        ],
      },
      select: {
        id: true, title: true, category: true, isUserDefined: true,
        content: true, confidence: true, timeHorizon: true, status: true,
        resolutionAnalysis: true, resolvedAt: true, viewedAt: true, createdAt: true,
        aiConfidence: true, aiAnalysis: true,
        article: { select: { id: true, title: true, url: true } },
      },
      orderBy: { resolvedAt: 'desc' },
      take: 100,
    })
    return Response.json(predictions)
  } catch (err) {
    console.error('Verified predictions error:', err)
    return Response.json([], { status: 500 })
  }
}
