import { agentProcesses } from '@/lib/agents'

export async function POST(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  const entry = agentProcesses.get(name)

  if (!entry || entry.exitCode !== null) {
    return Response.json({ success: false, message: 'Agent is not running' })
  }

  try {
    entry.process.kill('SIGTERM')
    // Force kill after 3s if still alive
    setTimeout(() => {
      try { if (entry.exitCode === null) entry.process.kill('SIGKILL') } catch { /* ignore */ }
    }, 3000)
    return Response.json({ success: true, message: 'Stop signal sent' })
  } catch (err) {
    return Response.json({ success: false, message: (err as Error).message }, { status: 500 })
  }
}
