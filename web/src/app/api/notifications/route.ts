import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUserId } from '@/lib/user'

export async function GET(req: Request) {
  const auth = await requireUserId()
  if (auth instanceof Response) return auth
  const { userId } = auth
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    const unreadCount = notifications.filter((n) => !n.readAt).length
    return NextResponse.json({ notifications, unreadCount })
  } catch (err) {
    console.error('Notifications GET error:', err)
    return NextResponse.json({ notifications: [], unreadCount: 0 }, { status: 500 })
  }
}
