import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const sort = (url.searchParams.get('sort') ?? 'stars') as 'stars' | 'forks' | 'recent' | 'pushed'
    const language = url.searchParams.get('language') ?? undefined
    const topic = url.searchParams.get('topic') ?? undefined
    const interestId = url.searchParams.get('interestId') ?? undefined
    const q = url.searchParams.get('q') ?? undefined
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '60', 10), 200)

    const where: Record<string, unknown> = {}
    if (language) where.language = language
    if (interestId) where.interestId = interestId
    if (topic) where.topics = { has: topic }
    if (q) {
      where.OR = [
        { repoName: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { owner: { contains: q, mode: 'insensitive' } },
      ]
    }

    const orderBy =
      sort === 'forks' ? { forks: 'desc' as const } :
      sort === 'recent' ? { scrapedAt: 'desc' as const } :
      sort === 'pushed' ? { lastPushed: 'desc' as const } :
      { stars: 'desc' as const }

    const repos = await prisma.gitHubRepo.findMany({
      where,
      orderBy,
      take: limit,
      select: {
        id: true,
        owner: true,
        repoName: true,
        fullName: true,
        description: true,
        url: true,
        stars: true,
        forks: true,
        watchers: true,
        language: true,
        topics: true,
        aiSummary: true,
        lastPushed: true,
        scrapedAt: true,
        viewedAt: true,
        interestId: true,
      },
    })

    // Facets for filtering UI
    const languages = await prisma.gitHubRepo.groupBy({
      by: ['language'],
      _count: true,
      where: { language: { not: null } },
      orderBy: { _count: { language: 'desc' } },
      take: 20,
    })

    return Response.json({
      repos,
      total: repos.length,
      languages: languages.map(l => ({ language: l.language!, count: l._count })),
    })
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
