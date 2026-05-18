import { prisma } from '@/lib/prisma'
import { requireUserId } from '@/lib/user'

export async function GET(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const auth = await requireUserId()
  if (auth instanceof Response) return auth
  const { userId } = auth
  try {
    const { sessionId } = await params
    const session = await prisma.webChatSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    })

    if (!session || session.userId !== userId) {
      return Response.json({ error: 'Session not found' }, { status: 404 })
    }

    return Response.json(session)
  } catch (err) {
    console.error('Session fetch error:', err)
    return Response.json({ error: 'Failed to fetch session' }, { status: 500 })
  }
}
