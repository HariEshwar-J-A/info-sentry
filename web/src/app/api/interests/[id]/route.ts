import { prisma } from '@/lib/prisma'
import { requireUserId } from '@/lib/user'

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUserId()
  if (auth instanceof Response) return auth
  const { userId } = auth
  const { id } = await params
  try {
    const { count } = await prisma.interest.updateMany({
      where: { id, userId },
      data: { isActive: false },
    })
    if (count === 0) return Response.json({ error: 'Not found' }, { status: 404 })
    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUserId()
  if (auth instanceof Response) return auth
  const { userId } = auth
  const { id } = await params
  try {
    const body = (await req.json()) as {
      isActive?: boolean
      description?: string
      score?: number
      trackNews?: boolean
      trackGithub?: boolean
      notificationThreshold?: number
    }
    const data = {
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.score !== undefined ? { score: body.score } : {}),
      ...(body.trackNews !== undefined ? { trackNews: body.trackNews } : {}),
      ...(body.trackGithub !== undefined ? { trackGithub: body.trackGithub } : {}),
      ...(body.notificationThreshold !== undefined ? { notificationThreshold: Math.max(0, Math.min(1, body.notificationThreshold)) } : {}),
    }
    if (Object.keys(data).length === 0) {
      const row = await prisma.interest.findFirst({ where: { id, userId } })
      if (!row) return Response.json({ error: 'Not found' }, { status: 404 })
      return Response.json({ interest: row })
    }
    const { count } = await prisma.interest.updateMany({
      where: { id, userId },
      data,
    })
    if (count === 0) return Response.json({ error: 'Not found' }, { status: 404 })
    const updated = await prisma.interest.findUniqueOrThrow({ where: { id } })
    return Response.json({ interest: updated })
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
