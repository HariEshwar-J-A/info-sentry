import { prisma } from '@/lib/prisma'
import { requireUserId } from '@/lib/user'
import { startGithubRun } from '@/lib/pipelineRuns'

// Legacy endpoint retained for compatibility; use /run-github for new UI.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUserId()
  if (auth instanceof Response) return auth
  const { userId } = auth
  const { id } = await params

  const interest = await prisma.interest.findFirst({ where: { id, userId } })
  if (!interest) return new Response('Not found', { status: 404 })

  const runId = await startGithubRun(id)
  return Response.json({ runId, topic: interest.topic })
}
