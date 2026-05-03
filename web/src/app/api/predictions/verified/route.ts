import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const predictions = await prisma.prediction.findMany({
      where: {
        status: { in: ['CORRECT', 'INCORRECT', 'PARTIALLY_CORRECT'] },
        resolutionAnalysis: { not: null },
      },
      include: {
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
