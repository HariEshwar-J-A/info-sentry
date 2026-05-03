import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const statusParam = url.searchParams.get('status')
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '200', 10), 500)

    const where: Prisma.PredictionWhereInput = statusParam
      ? { status: statusParam as Prisma.EnumPredictionStatusFilter }
      : {}

    const predictions = await prisma.prediction.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
      select: {
        id: true,
        content: true,
        confidence: true,
        timeHorizon: true,
        status: true,
        trackedByUser: true,
        trackedAt: true,
        dueDate: true,
        resolutionAnalysis: true,
        viewedAt: true,
        createdAt: true,
        article: { select: { id: true, title: true, url: true } },
      },
    })

    return Response.json(predictions)
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
