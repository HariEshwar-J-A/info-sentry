import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUserId } from '@/lib/user'

export async function GET(request: Request) {
  const auth = await requireUserId()
  if (auth instanceof Response) return auth
  const { userId } = auth

  const url = new URL(request.url)
  const channelId = url.searchParams.get('channelId') ?? undefined
  const limit = parseInt(url.searchParams.get('limit') ?? '50', 10)

  try {
    const videos = await prisma.videoItem.findMany({
      where: {
        channel: { userId, isActive: true },
        ...(channelId ? { channelId } : {}),
      },
      orderBy: { publishedAt: 'desc' },
      take: limit,
      include: {
        channel: { select: { id: true, channelName: true, platform: true } },
      },
    })
    return NextResponse.json(videos)
  } catch (error) {
    console.error('Video feed API error:', error)
    return NextResponse.json({ error: 'Failed to fetch videos' }, { status: 500 })
  }
}
