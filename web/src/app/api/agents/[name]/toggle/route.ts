import { prisma } from '@/lib/prisma'

export async function POST(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  try {
    const config = await prisma.agentConfig.findUnique({ where: { agentName: name } })
    const newActive = !(config?.isActive ?? true)

    await prisma.agentConfig.upsert({
      where: { agentName: name },
      update: { isActive: newActive },
      create: { agentName: name, isActive: newActive },
    })

    return Response.json({ success: true, isActive: newActive })
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
