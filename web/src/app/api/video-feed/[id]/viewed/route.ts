import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUserId } from '@/lib/user'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUserId()
  if (auth instanceof Response) return auth
  const { userId } = auth
  const { id } = await params

  await prisma.videoItem.updateMany({ where: { id }, data: { viewedAt: new Date() } }).catch(() => {})

  // Auto-read any NEW_VIDEO notification for this video
  await prisma.notification.updateMany({
    where: { userId, readAt: null, data: { path: ['videoId'], equals: id } },
    data: { readAt: new Date() },
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
