import { prisma } from '@/lib/prisma'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { dueDate, userNotes } = (await request.json()) as {
      dueDate?: string
      userNotes?: string
    }

    const prediction = await prisma.prediction.update({
      where: { id },
      data: {
        trackedByUser: true,
        trackedAt: new Date(),
        dueDate: dueDate ? new Date(dueDate) : undefined,
        userNotes: userNotes ?? undefined,
      },
      select: { id: true, trackedByUser: true, trackedAt: true, dueDate: true, status: true },
    })

    return Response.json({ success: true, prediction })
  } catch (err) {
    console.error('Track prediction error:', err)
    return Response.json({ error: 'Failed to track prediction' }, { status: 500 })
  }
}
