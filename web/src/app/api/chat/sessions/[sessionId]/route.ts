import { prisma } from '@/lib/prisma'

export async function GET(_req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await params
    const session = await prisma.webChatSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    })

    if (!session) {
      return Response.json({ error: 'Session not found' }, { status: 404 })
    }

    return Response.json(session)
  } catch (err) {
    console.error('Session fetch error:', err)
    return Response.json({ error: 'Failed to fetch session' }, { status: 500 })
  }
}
