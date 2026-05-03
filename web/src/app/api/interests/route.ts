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
        // Reactivate
        const updated = await prisma.interest.update({
          where: { id: existing.id },
          data: { isActive: true, description: description?.trim() || existing.description },
        })
        return Response.json({ interest: updated, reactivated: true })
      }
      return Response.json({ error: 'Topic already exists' }, { status: 409 })
    }

    // Generate search keywords using a simple heuristic (fast, no LLM call)
    const words = topic.trim().toLowerCase().split(/\s+/)
    const baseKeywords = words.filter((w) => w.length > 2)

    // Create interest
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

    // Link to ALL active sources so scout picks this up
    const sources = await prisma.source.findMany({
      where: { isActive: true },
      select: { id: true },
    })

    if (sources.length > 0) {
      await prisma.interestSource.createMany({
        data: sources.map((s) => ({ interestId: interest.id, sourceId: s.id })),
        skipDuplicates: true,
      })
    }

    return Response.json({ interest, sourcesLinked: sources.length }, { status: 201 })
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
