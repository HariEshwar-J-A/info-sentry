import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { OWNER_USER_ID } from '@/lib/user'

export async function GET() {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: OWNER_USER_ID },
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
