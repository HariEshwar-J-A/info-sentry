import { prisma } from '@/lib/prisma'

// PATCH /api/sources/[id] — update name, trustScore, rssUrl, isActive
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const body = (await req.json()) as {
      name?: string
      trustScore?: number
      rssUrl?: string | null
      isActive?: boolean
    }

    const source = await prisma.source.findUnique({ where: { id } })
    if (!source) return Response.json({ error: 'Not found' }, { status: 404 })

    const updated = await prisma.source.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.trustScore !== undefined ? { trustScore: Math.min(1, Math.max(0, body.trustScore)) } : {}),
        ...(body.rssUrl !== undefined ? { rssUrl: body.rssUrl?.trim() || null } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      },
    })

    return Response.json({ source: updated })
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}

// DELETE /api/sources/[id] — hard-delete global source (unlinks from all interests)
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    await prisma.source.delete({ where: { id } })
    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
