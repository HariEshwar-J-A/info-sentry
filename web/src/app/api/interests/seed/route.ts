import { prisma } from '@/lib/prisma'
import { requireUserId } from '@/lib/user'
import { startNewsRun } from '@/lib/pipelineRuns'

// Legacy endpoint retained for compatibility; use /api/interests/[id]/run-news.
export async function POST(req: Request) {
  const auth = await requireUserId()
  if (auth instanceof Response) return auth
  const { userId } = auth
  const { interestId } = await req.json().catch(() => ({} as { interestId?: string }))
  if (!interestId) return Response.json({ error: 'interestId is required' }, { status: 400 })

  const interest = await prisma.interest.findFirst({ where: { id: interestId, userId } })
  if (!interest) return Response.json({ error: 'Not found' }, { status: 404 })

  const runId = await startNewsRun(interestId)
  return Response.json({ runId, topic: interest.topic })
}
