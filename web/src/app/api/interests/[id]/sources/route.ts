import { prisma } from '@/lib/prisma'
import { OWNER_USER_ID } from '@/lib/user'

// GET /api/interests/[id]/sources — list sources linked to this interest
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const interest = await prisma.interest.findFirst({ where: { id, userId: OWNER_USER_ID } })
    if (!interest) return Response.json({ error: 'Not found' }, { status: 404 })

    const junctions = await prisma.interestSource.findMany({
      where: { interestId: id },
      include: {
        source: {
          select: { id: true, name: true, url: true, rssUrl: true, trustScore: true, isActive: true, type: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    const sources = junctions.map(j => ({ ...j.source, junctionId: j.id }))
    return Response.json({ sources })
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}

// POST /api/interests/[id]/sources — add (or create) a source and link it
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const interest = await prisma.interest.findFirst({ where: { id, userId: OWNER_USER_ID } })
    if (!interest) return Response.json({ error: 'Not found' }, { status: 404 })

    const body = (await req.json()) as {
      url: string
      rssUrl?: string
      name?: string
      trustScore?: number
    }

    if (!body.url?.trim()) return Response.json({ error: 'URL is required' }, { status: 400 })

    const url = body.url.trim().replace(/\/$/, '')
    const rssUrl = body.rssUrl?.trim() || null
    const trustScore = typeof body.trustScore === 'number'
      ? Math.min(1, Math.max(0, body.trustScore))
      : 0.7

    // Auto-generate name from domain if not provided
    let name = body.name?.trim()
    if (!name) {
      try {
        const domain = new URL(url).hostname.replace(/^www\./, '')
        name = domain.charAt(0).toUpperCase() + domain.slice(1)
      } catch {
        name = url.slice(0, 40)
      }
    }

    // Upsert global source (create if new URL, update rss/name if existing)
    const source = await prisma.source.upsert({
      where: { url },
      create: { name, url, rssUrl, trustScore, isActive: true },
      update: {
        ...(rssUrl ? { rssUrl } : {}),
        ...(body.name ? { name } : {}),
      },
    })

    // Link to interest (skip if already linked)
    await prisma.interestSource.upsert({
      where: { interestId_sourceId: { interestId: id, sourceId: source.id } },
      update: {},
      create: { interestId: id, sourceId: source.id },
    })

    return Response.json({ source }, { status: 201 })
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
