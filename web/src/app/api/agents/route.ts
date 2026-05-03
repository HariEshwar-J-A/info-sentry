import { prisma } from '@/lib/prisma'
import { AGENT_DEFS, agentProcesses, AVAILABLE_MODELS } from '@/lib/agents'

export async function GET() {
  try {
    const configs = await prisma.agentConfig.findMany({ orderBy: { agentName: 'asc' } })

    const agents = Object.entries(AGENT_DEFS).map(([name, def]) => {
      const config = configs.find(c => c.agentName === name)
      const running = agentProcesses.get(name)
      const settings = (config?.settings ?? {}) as Record<string, string>

      return {
        name,
        label: def.label,
        description: def.description,
        icon: def.icon,
        canRun: def.script !== null,
        defaultModel: def.defaultModel,
        currentModel: settings['modelId'] ?? def.defaultModel,
        isActive: config?.isActive ?? true,
        lastRunAt: config?.lastRunAt ?? null,
        lastError: config?.lastError ?? null,
        isRunning: !!running && running.exitCode === null,
        runningFor: running ? Math.round((Date.now() - running.startedAt.getTime()) / 1000) : null,
      }
    })

    return Response.json({ agents, models: AVAILABLE_MODELS })
  } catch (err) {
    console.error('Agents GET error:', err)
    return Response.json({ agents: [], models: [] }, { status: 500 })
  }
}
