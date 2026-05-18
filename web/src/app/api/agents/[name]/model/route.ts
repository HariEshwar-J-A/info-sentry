import { prisma } from '@/lib/prisma'
import { AVAILABLE_MODELS } from '@/lib/agents'

export async function PUT(request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  try {
    const { modelId } = (await request.json()) as { modelId: string }

    if (!AVAILABLE_MODELS.find(m => m.id === modelId)) {
      return Response.json({ error: 'Unknown model' }, { status: 400 })
    }

    const config = await prisma.agentConfig.findUnique({ where: { agentName: name } })
    const settings = { ...((config?.settings ?? {}) as Record<string, unknown>), modelId }

    await prisma.agentConfig.upsert({
      where: { agentName: name },
      update: { settings },
      create: { agentName: name, settings },
    })

    return Response.json({ success: true, modelId })
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
