import { prisma } from '@/lib/prisma'
import { requireUserId } from '@/lib/user'
import { startGithubRun } from '@/lib/pipelineRuns'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUserId()
  if (auth instanceof Response) return auth
  const { userId } = auth
  const { id } = await params

  const interest = await prisma.interest.findFirst({ where: { id, userId } })
  if (!interest) return new Response('Not found', { status: 404 })
  if (!interest.trackGithub) return Response.json({ error: 'GitHub tracking is disabled for this topic' }, { status: 400 })

  const runId = await startGithubRun(id)
  return Response.json({ runId })
}
