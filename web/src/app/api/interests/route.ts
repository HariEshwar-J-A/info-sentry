import { prisma } from '@/lib/prisma'
import { requireUserId } from '@/lib/user'

export async function GET(req: Request) {
  const auth = await requireUserId()
  if (auth instanceof Response) return auth
  const { userId } = auth
  try {
    const interests = await prisma.interest.findMany({
      where: { userId },
      orderBy: [{ isActive: 'desc' }, { score: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        topic: true,
        description: true,
        score: true,
        isActive: true,
        trackNews: true,
        trackGithub: true,
        searchKeywords: true,
        createdAt: true,
        _count: { select: { sources: true } },
      },
    })
    return Response.json({ interests })
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}

// Create (or reuse) a Google News RSS source for a topic and return its id
async function ensureGoogleNewsSource(topic: string): Promise<string> {
  const query = encodeURIComponent(topic)
  const rssUrl = `https://news.google.com/rss/search?q=${query}&hl=en&gl=US&ceid=US:en`
  const webUrl = `https://news.google.com/search?q=${query}&hl=en&gl=US&ceid=US:en`
  const sourceName = `Google News: ${topic}`

  const existing = await prisma.source.findFirst({ where: { rssUrl } })
  if (existing) return existing.id

  const created = await prisma.source.create({
    data: {
      name: sourceName,
      url: webUrl,
      rssUrl,
      type: 'WEB',
      isActive: true,
      trustScore: 0.7,
    },
  })
  return created.id
}

export async function POST(req: Request) {
  const auth = await requireUserId()
  if (auth instanceof Response) return auth
  const { userId } = auth
  try {
    const { topic, description, trackNews, trackGithub } = (await req.json()) as {
      topic: string
      description?: string
      trackNews?: boolean
      trackGithub?: boolean
    }

    if (!topic?.trim()) {
      return Response.json({ error: 'Topic is required' }, { status: 400 })
    }

    // Check duplicate
    const existing = await prisma.interest.findUnique({
      where: { userId_topic: { userId, topic: topic.trim() } },
    })
    if (existing) {
      if (!existing.isActive) {
        const updated = await prisma.interest.update({
          where: { id: existing.id },
          data: {
            isActive: true,
            description: description?.trim() || existing.description,
            trackNews: trackNews ?? existing.trackNews,
            trackGithub: trackGithub ?? existing.trackGithub,
          },
        })
        // Ensure Google News source exists and is linked even on reactivation
        const gnSourceId = await ensureGoogleNewsSource(topic.trim())
        await prisma.interestSource.upsert({
          where: { interestId_sourceId: { interestId: existing.id, sourceId: gnSourceId } },
          update: {},
          create: { interestId: existing.id, sourceId: gnSourceId },
        })
        return Response.json({ interest: updated, reactivated: true })
      }
      return Response.json({ error: 'Topic already exists' }, { status: 409 })
    }

    const words = topic.trim().toLowerCase().split(/\s+/)
    const baseKeywords = words.filter((w) => w.length > 2)

    const effectiveTrackNews = trackNews ?? true
    const effectiveTrackGithub = trackGithub ?? false

    const interest = await prisma.interest.create({
      data: {
        userId,
        topic: topic.trim(),
        description: description?.trim() || null,
        trackNews: effectiveTrackNews,
        trackGithub: effectiveTrackGithub,
        searchKeywords: baseKeywords,
        score: 1.0,
        isActive: true,
      },
    })

    // Create/reuse a Google News RSS source dedicated to this topic
    const gnSourceId = await ensureGoogleNewsSource(topic.trim())
    await prisma.interestSource.upsert({
      where: { interestId_sourceId: { interestId: interest.id, sourceId: gnSourceId } },
      update: {},
      create: { interestId: interest.id, sourceId: gnSourceId },
    })

    return Response.json({ interest, sourcesLinked: 1 }, { status: 201 })
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
