import { prisma } from '@/lib/prisma'
import { requireUserId } from '@/lib/user'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUserId()
  if (auth instanceof Response) return auth
  const { userId } = auth
  const { id } = await params

  const run = await prisma.pipelineRun.findFirst({
    where: { id, interest: { userId } },
    include: { interest: { select: { id: true, topic: true } } },
  })
  if (!run) return new Response('Not found', { status: 404 })
  return Response.json({ run })
}
