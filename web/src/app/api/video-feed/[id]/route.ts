import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUserId } from '@/lib/user'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUserId()
  if (auth instanceof Response) return auth
  const { userId } = auth
  const { id } = await params

  const video = await prisma.videoItem.findFirst({
    where: { id, channel: { userId } },
    include: { channel: { select: { id: true, channelName: true, channelUrl: true, platform: true } } },
  })

  if (!video) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Mark as viewed
  if (!video.viewedAt) {
    await prisma.videoItem.update({ where: { id }, data: { viewedAt: new Date() } }).catch(() => {})
  }

  return NextResponse.json(video)
}
