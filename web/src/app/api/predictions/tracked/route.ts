import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const predictions = await prisma.prediction.findMany({
      where: { trackedByUser: true },
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
