import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUserId } from '@/lib/user'

// Explicit dismiss — permanently removes from notification list
export async function POST(request: Request) {
  const auth = await requireUserId()
  if (auth instanceof Response) return auth
  const { userId } = auth

  try {
    const body = (await request.json()) as { ids?: string[]; all?: boolean }

    if (body.all) {
      await prisma.notification.deleteMany({ where: { userId } })
    } else if (body.ids && body.ids.length > 0) {
      await prisma.notification.deleteMany({ where: { userId, id: { in: body.ids } } })
    } else {
      return NextResponse.json({ error: 'ids or all required' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Notification dismiss error:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
