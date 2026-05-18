import { spawn } from 'child_process'
import path from 'path'
import { AGENT_DEFS, agentProcesses, REPO_ROOT } from '@/lib/agents'
import { prisma } from '@/lib/prisma'
import { requireUserId } from '@/lib/user'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const auth = await requireUserId()
  if (auth instanceof Response) return auth
  const { userId } = auth

  const { name } = await params
  const def = AGENT_DEFS[name]

  if (!def) return Response.json({ error: 'Unknown agent' }, { status: 404 })
  if (!def.script) return Response.json({ error: `Agent "${name}" cannot be run standalone` }, { status: 400 })

  // Kill existing process for this agent if still running
  const existing = agentProcesses.get(name)
  if (existing && existing.exitCode === null) {
    try { existing.process.kill('SIGTERM') } catch { /* ignore */ }
  }

  const body = await request.json().catch(() => ({})) as { args?: string[] }
  const extraArgs = body.args ?? def.args ?? []

  const scriptPath = path.join(REPO_ROOT, def.script)

  // Read stored model preference from DB
  const config = await prisma.agentConfig.findUnique({ where: { agentName: name } })
  const settings = (config?.settings ?? {}) as Record<string, string>
  const modelOverride = settings['modelId'] ?? ''

  const env = {
    ...process.env,
    FORCE_COLOR: '0',
    NO_COLOR: '1',
    INFO_SENTRY_USER_ID: userId,
    ...(modelOverride ? { AGENT_MODEL_OVERRIDE: modelOverride } : {}),
  }

  const child = spawn('npx', ['tsx', scriptPath, ...extraArgs], {
    cwd: REPO_ROOT,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  const entry = { process: child, startedAt: new Date(), lines: [] as string[], exitCode: null as number | null }
  agentProcesses.set(name, entry)

  // Update lastRunAt
  await prisma.agentConfig.upsert({
    where: { agentName: name },
    update: { lastRunAt: new Date(), lastError: null },
    create: { agentName: name, lastRunAt: new Date() },
  }).catch(() => {})

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      function send(type: string, text: string) {
        entry.lines.push(`[${type}] ${text}`)
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, text })}\n\n`))
      }

      send('system', `Starting ${def.label}…`)
      send('system', `Script: ${def.script}`)
      if (modelOverride) send('system', `Model override: ${modelOverride}`)
      send('system', `Working dir: ${REPO_ROOT}`)
      send('system', '─'.repeat(40))

      child.stdout?.on('data', (chunk: Buffer) => {
        const lines = chunk.toString().split('\n').filter(l => l.trim())
        for (const line of lines) send('stdout', line)
      })

      child.stderr?.on('data', (chunk: Buffer) => {
        const lines = chunk.toString().split('\n').filter(l => l.trim())
        for (const line of lines) send('stderr', line)
      })

      child.on('close', (code) => {
        entry.exitCode = code ?? 0
        send('system', '─'.repeat(40))
        send('system', `Process exited with code ${code ?? 0}`)
        if (code !== 0) {
          prisma.agentConfig.update({
            where: { agentName: name },
            data: { lastError: `Exit code ${code}` },
          }).catch(() => {})
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      })

      child.on('error', (err) => {
        send('error', err.message)
        entry.exitCode = 1
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      })
    },
    cancel() {
      try { child.kill('SIGTERM') } catch { /* ignore */ }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
