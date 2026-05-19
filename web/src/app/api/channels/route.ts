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
  channelName?: string
  channelId?: string
  rssFeedUrl?: string
  platform?: string
}

export async function POST(request: Request) {
  const auth = await requireUserId()
  if (auth instanceof Response) return auth
  const { userId } = auth

  try {
    const body = (await request.json()) as AddChannelBody
    let { channelUrl, channelName, channelId, rssFeedUrl, platform = 'YOUTUBE' } = body

    if (!channelUrl) {
      return NextResponse.json({ error: 'channelUrl is required' }, { status: 400 })
    }

    // Normalize channel ID: YouTube IDs start with UC (uppercase)
    if (channelId && channelId.toLowerCase().startsWith('uc') && !channelId.startsWith('UC')) {
      channelId = 'UC' + channelId.slice(2)
    }

    // Auto-resolve from URL if channelId is missing or looks wrong
    if (!channelId || channelId.length < 10) {
      try {
        let fetchUrl = channelUrl.trim()
        if (!fetchUrl.startsWith('http')) fetchUrl = `https://www.youtube.com/${fetchUrl.startsWith('@') ? fetchUrl : '@' + fetchUrl}`
        const res = await fetch(fetchUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
          signal: AbortSignal.timeout(12_000),
        })
        if (res.ok) {
          const html = await res.text()
          const idMatch = html.match(/"externalId":"(UC[^"]{20,})"/) ?? html.match(/channel\/(UC[^"?&/]{20,})/)
          if (idMatch?.[1]) channelId = idMatch[1]
          if (!channelName) {
            const nm = html.match(/"author":"([^"]+)"/) ?? html.match(/<title>([^<]+)<\/title>/)
            channelName = nm?.[1]?.replace(' - YouTube', '').trim()
          }
        }
      } catch { /* non-fatal — fall through */ }
    }

    if (!channelId) {
      return NextResponse.json({ error: 'Could not determine channel ID. Use the Resolve button or paste the full YouTube channel URL.' }, { status: 400 })
    }

    const channel = await prisma.videoChannel.create({
      data: {
        userId,
        channelUrl,
        channelName: channelName ?? channelId,
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

interface UpdateChannelBody {
  id: string
  transcriptSource?: string
  maxAgeDays?: number
  isActive?: boolean
}

export async function PATCH(request: Request) {
  const auth = await requireUserId()
  if (auth instanceof Response) return auth
  const { userId } = auth

  try {
    const body = (await request.json()) as UpdateChannelBody
    const { id, transcriptSource, maxAgeDays, isActive } = body

    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const channel = await prisma.videoChannel.findFirst({ where: { id, userId } })
    if (!channel) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const updated = await prisma.videoChannel.update({
      where: { id },
      data: {
        ...(transcriptSource !== undefined ? { transcriptSource } : {}),
        ...(maxAgeDays !== undefined ? { maxAgeDays } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
    })

    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Failed to update channel' }, { status: 500 })
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
