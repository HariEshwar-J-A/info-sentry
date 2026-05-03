import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { OWNER_USER_ID } from '@/lib/user'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as { ids?: string[] }
    const now = new Date()

    if (body.ids && body.ids.length > 0) {
      await prisma.notification.updateMany({
        where: { userId: OWNER_USER_ID, id: { in: body.ids }, readAt: null },
        data: { readAt: now },
      })
    } else {
      await prisma.notification.updateMany({
        where: { userId: OWNER_USER_ID, readAt: null },
        data: { readAt: now },
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Notifications read error:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
