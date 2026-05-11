import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUserId } from '@/lib/user'

export async function GET() {
  const auth = await requireUserId()
  if (auth instanceof Response) return auth
  const { userId } = auth

  const channels = await prisma.videoChannel.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { videos: true } } },
  })
  return NextResponse.json(channels)
}

interface AddChannelBody {
  channelUrl: string
  channelName: string
  channelId: string
  rssFeedUrl?: string
  platform?: string
}

export async function POST(request: Request) {
  const auth = await requireUserId()
  if (auth instanceof Response) return auth
  const { userId } = auth

  try {
    const body = (await request.json()) as AddChannelBody
    const { channelUrl, channelName, channelId, rssFeedUrl, platform = 'YOUTUBE' } = body

    if (!channelUrl || !channelName || !channelId) {
      return NextResponse.json({ error: 'channelUrl, channelName, and channelId are required' }, { status: 400 })
    }

    const channel = await prisma.videoChannel.create({
      data: {
        userId,
        channelUrl,
        channelName,
        channelId,
        rssFeedUrl: rssFeedUrl ?? `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`,
        platform: platform as 'YOUTUBE' | 'TIKTOK' | 'INSTAGRAM' | 'PODCAST',
        isActive: true,
      },
    })

    return NextResponse.json(channel)
  } catch (error) {
    const msg = (error as Error).message
    if (msg.includes('Unique constraint')) {
      return NextResponse.json({ error: 'Channel already added' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to add channel' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const auth = await requireUserId()
  if (auth instanceof Response) return auth
  const { userId } = auth

  const url = new URL(request.url)
  const id = url.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const channel = await prisma.videoChannel.findFirst({ where: { id, userId } })
  if (!channel) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.videoChannel.delete({ where: { id } })
  return NextResponse.json({ deleted: true })
}
