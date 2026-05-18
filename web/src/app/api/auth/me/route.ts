import { getSessionUserId } from '@/lib/session'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const userId = await getSessionUserId()
  if (!userId) return Response.json({ authenticated: false }, { status: 401 })
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      googleSub: true,
      _count: { select: { interests: true, chatMessages: true } },
    },
  })
  return Response.json({ authenticated: true, userId, user })
}
