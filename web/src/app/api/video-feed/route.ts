import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUserId } from '@/lib/user'

export async function GET(request: Request) {
  const auth = await requireUserId()
  if (auth instanceof Response) return auth
  const { userId } = auth

  const url = new URL(request.url)
  const channelId = url.searchParams.get('channelId') ?? undefined
  const q = url.searchParams.get('q') ?? undefined
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10))
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20', 10)))
  const skip = (page - 1) * limit

  const where = {
    channel: { userId, isActive: true },
    ...(channelId ? { channelId } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: 'insensitive' as const } },
            { description: { contains: q, mode: 'insensitive' as const } },
            { transcript: { contains: q, mode: 'insensitive' as const } },
            { aiSummary: { contains: q, mode: 'insensitive' as const } },
            { channel: { channelName: { contains: q, mode: 'insensitive' as const } } },
          ],
        }
      : {}),
  }

  try {
    const [total, videos] = await Promise.all([
      prisma.videoItem.count({ where }),
      prisma.videoItem.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip,
        take: limit,
        include: {
          channel: { select: { id: true, channelName: true, platform: true } },
        },
      }),
    ])

    return NextResponse.json({
      videos,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
      limit,
    })
  } catch (error) {
    console.error('Video feed API error:', error)
    return NextResponse.json({ error: 'Failed to fetch videos' }, { status: 500 })
  }
}
