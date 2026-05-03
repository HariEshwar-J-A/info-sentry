import { prisma } from '@/lib/prisma'
import { OWNER_USER_ID } from '@/lib/user'

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const interest = await prisma.interest.findFirst({
      where: { id, userId: OWNER_USER_ID },
    })
    if (!interest) return Response.json({ error: 'Not found' }, { status: 404 })

    await prisma.interest.update({ where: { id }, data: { isActive: false } })
    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const body = (await req.json()) as { isActive?: boolean; description?: string; score?: number }
    const interest = await prisma.interest.findFirst({ where: { id, userId: OWNER_USER_ID } })
    if (!interest) return Response.json({ error: 'Not found' }, { status: 404 })

    const updated = await prisma.interest.update({
      where: { id },
      data: {
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.score !== undefined ? { score: body.score } : {}),
      },
    })
    return Response.json({ interest: updated })
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
