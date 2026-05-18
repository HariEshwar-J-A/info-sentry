import { prisma } from '@/lib/prisma'
import { requireUserId } from '@/lib/user'

export async function GET(req: Request) {
  const auth = await requireUserId()
  if (auth instanceof Response) return auth
  const { userId } = auth

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const kind = searchParams.get('kind')
  const interestId = searchParams.get('interestId')
  const take = Math.min(parseInt(searchParams.get('take') ?? '50', 10), 200)

  const runs = await prisma.pipelineRun.findMany({
    where: {
      ...(status ? { status: status as 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED' } : {}),
      ...(kind ? { kind: kind as 'NEWS' | 'GITHUB' } : {}),
      ...(interestId ? { interestId } : {}),
      interest: { userId },
    },
    include: {
      interest: { select: { id: true, topic: true } },
    },
    orderBy: { startedAt: 'desc' },
    take,
  })

  return Response.json({ runs })
}
