import { prisma } from '@/lib/prisma'
import { OWNER_USER_ID } from '@/lib/user'

// DELETE /api/interests/[id]/sources/[sourceId] — unlink source from interest
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; sourceId: string }> },
) {
  const { id, sourceId } = await params
  try {
    const interest = await prisma.interest.findFirst({ where: { id, userId: OWNER_USER_ID } })
    if (!interest) return Response.json({ error: 'Not found' }, { status: 404 })

    await prisma.interestSource.deleteMany({
      where: { interestId: id, sourceId },
    })

    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
