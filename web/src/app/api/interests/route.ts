import { prisma } from '@/lib/prisma'
import { OWNER_USER_ID } from '@/lib/user'

export async function GET() {
  try {
    const interests = await prisma.interest.findMany({
      where: { userId: OWNER_USER_ID },
      orderBy: [{ isActive: 'desc' }, { score: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        topic: true,
        description: true,
        score: true,
        isActive: true,
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
  try {
    const { topic, description } = (await req.json()) as { topic: string; description?: string }

    if (!topic?.trim()) {
      return Response.json({ error: 'Topic is required' }, { status: 400 })
    }

    // Check duplicate
    const existing = await prisma.interest.findUnique({
      where: { userId_topic: { userId: OWNER_USER_ID, topic: topic.trim() } },
    })
    if (existing) {
      if (!existing.isActive) {
        const updated = await prisma.interest.update({
          where: { id: existing.id },
          data: { isActive: true, description: description?.trim() || existing.description },
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

    const interest = await prisma.interest.create({
      data: {
        userId: OWNER_USER_ID,
        topic: topic.trim(),
        description: description?.trim() || null,
        searchKeywords: baseKeywords,
        score: 1.0,
        isActive: true,
      },
    })

    // 1. Link to all existing active sources
    const existingSources = await prisma.source.findMany({
      where: { isActive: true },
      select: { id: true },
    })
    if (existingSources.length > 0) {
      await prisma.interestSource.createMany({
        data: existingSources.map((s) => ({ interestId: interest.id, sourceId: s.id })),
        skipDuplicates: true,
      })
    }

    // 2. Create/reuse a Google News RSS source dedicated to this topic
    const gnSourceId = await ensureGoogleNewsSource(topic.trim())
    await prisma.interestSource.upsert({
      where: { interestId_sourceId: { interestId: interest.id, sourceId: gnSourceId } },
      update: {},
      create: { interestId: interest.id, sourceId: gnSourceId },
    })

    return Response.json({ interest, sourcesLinked: existingSources.length + 1 }, { status: 201 })
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
