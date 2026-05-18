import { prisma } from '@/lib/prisma'
import { AGENT_DEFS, REPO_ROOT } from '@/lib/agents'
import { requireUserId } from '@/lib/user'

export async function PUT(request: Request, { params }: { params: Promise<{ name: string }> }) {
  const auth = await requireUserId()
  if (auth instanceof Response) return auth

  const { name } = await params
  if (!AGENT_DEFS[name]) return Response.json({ error: 'Unknown agent' }, { status: 404 })

  try {
    const { cronSchedule } = (await request.json()) as { cronSchedule: string | null }

    await prisma.agentConfig.upsert({
      where: { agentName: name },
      update: { cronSchedule: cronSchedule || null },
      create: { agentName: name, cronSchedule: cronSchedule || null },
    })

    return Response.json({ success: true, cronSchedule, repoRoot: REPO_ROOT })
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
