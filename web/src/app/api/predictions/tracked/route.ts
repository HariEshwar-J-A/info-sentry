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
          { trackedByUser: true },
        ],
      },
      include: {
        article: { select: { id: true, title: true, url: true } },
      },
      orderBy: [
        { dueDate: 'asc' },
        { createdAt: 'desc' },
      ],
    })

    return Response.json(predictions)
  } catch (err) {
    console.error('Tracked predictions error:', err)
    return Response.json([], { status: 500 })
  }
}
