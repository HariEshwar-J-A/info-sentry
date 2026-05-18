import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const type = url.searchParams.get('type') ?? undefined   // WEB | RSS | API
    const q = url.searchParams.get('q') ?? undefined

    const sources = await prisma.source.findMany({
      where: {
        ...(type ? { type: type as 'WEB' | 'RSS' | 'API' } : {}),
        ...(q ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { url: { contains: q, mode: 'insensitive' } },
          ],
        } : {}),
      },
      include: {
        interests: {
          include: {
            interest: { select: { id: true, topic: true, isActive: true } },
          },
        },
        _count: { select: { articles: true } },
      },
      orderBy: [{ isActive: 'desc' }, { trustScore: 'desc' }, { name: 'asc' }],
    })

    // Find the most recent article per source
    const sourceIds = sources.map(s => s.id)
    const latestArticles = await prisma.article.groupBy({
      by: ['sourceId'],
      where: { sourceId: { in: sourceIds } },
      _max: { scrapedAt: true },
    })
    const latestMap = new Map(latestArticles.map(a => [a.sourceId, a._max.scrapedAt]))

    const result = sources.map(s => ({
      id: s.id,
      name: s.name,
      url: s.url,
      rssUrl: s.rssUrl,
      type: s.type,
      trustScore: s.trustScore,
      isActive: s.isActive,
      articleCount: s._count.articles,
      lastArticleAt: latestMap.get(s.id) ?? null,
      linkedTopics: s.interests.map(j => j.interest).filter(Boolean),
      createdAt: s.createdAt,
    }))

    return Response.json({ sources: result, total: result.length })
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      name: string; url: string; rssUrl?: string; trustScore?: number; type?: string
    }
    if (!body.url?.trim() || !body.name?.trim()) {
      return Response.json({ error: 'name and url are required' }, { status: 400 })
    }
    const source = await prisma.source.create({
      data: {
        name: body.name.trim(),
        url: body.url.trim(),
        rssUrl: body.rssUrl?.trim() || null,
        trustScore: body.trustScore ?? 0.6,
        type: (body.type as 'WEB' | 'RSS' | 'API') ?? 'WEB',
        isActive: true,
      },
    })
    return Response.json({ source }, { status: 201 })
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
