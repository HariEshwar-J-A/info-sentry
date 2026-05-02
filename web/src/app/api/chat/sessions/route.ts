import { prisma } from '@/lib/prisma'
import { OWNER_USER_ID } from '@/lib/user'

export async function GET() {
  try {
    const sessions = await prisma.webChatSession.findMany({
      where: { userId: OWNER_USER_ID },
      orderBy: { updatedAt: 'desc' },
      take: 30,
      include: {
        messages: { orderBy: { createdAt: 'asc' }, take: 1 },
      },
    })

    const result = sessions.map((s) => ({
      id: s.id,
      title: s.title,
      preview: s.messages[0]?.content?.slice(0, 80) ?? '',
      updatedAt: s.updatedAt,
      createdAt: s.createdAt,
    }))

    return Response.json(result)
  } catch (err) {
    console.error('Sessions list error:', err)
    return Response.json([], { status: 500 })
  }
}
