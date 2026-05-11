import { spawn } from 'child_process'
import path from 'path'
import { agentProcesses, REPO_ROOT } from '@/lib/agents'
import { prisma } from '@/lib/prisma'
import { requireUserId } from '@/lib/user'

// Full pipeline: scout → analyst pipeline (sequential)
export async function POST() {
  const auth = await requireUserId()
  if (auth instanceof Response) return auth
  const { userId } = auth

  const key = '__full_pipeline__'

  // Stop any existing full-pipeline run
  const existing = agentProcesses.get(key)
  if (existing && existing.exitCode === null) {
    try { existing.process.kill('SIGTERM') } catch { /* ignore */ }
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      function send(type: string, text: string) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, text })}\n\n`))
      }

      send('system', '⚡ Full pipeline run starting…')
      send('system', '─'.repeat(40))

      async function runScript(label: string, scriptFile: string): Promise<boolean> {
        return new Promise((resolve) => {
          send('system', `\n▶ ${label}`)
          const scriptPath = path.join(REPO_ROOT, scriptFile)
          const child = spawn('npx', ['tsx', scriptPath], {
            cwd: REPO_ROOT,
            env: {
              ...process.env,
              FORCE_COLOR: '0',
              NO_COLOR: '1',
              INFO_SENTRY_USER_ID: userId,
            },
            stdio: ['ignore', 'pipe', 'pipe'],
          })

          const entry = { process: child, startedAt: new Date(), lines: [] as string[], exitCode: null as number | null }
          agentProcesses.set(key, entry)

          child.stdout?.on('data', (chunk: Buffer) => {
            chunk.toString().split('\n').filter(l => l.trim()).forEach(l => send('stdout', l))
          })
          child.stderr?.on('data', (chunk: Buffer) => {
            chunk.toString().split('\n').filter(l => l.trim()).forEach(l => send('stderr', l))
          })
          child.on('close', (code) => {
            entry.exitCode = code ?? 0
            send('system', `✓ ${label} finished (exit ${code ?? 0})`)
            resolve(code === 0)
          })
          child.on('error', (err) => {
            entry.exitCode = 1
            send('error', `${label} error: ${err.message}`)
            resolve(false)
          })
        })
      }

      try {
        // 1. Scout
        await runScript('Scout — scraping sources', 'scripts/scout-run.ts')

        // 2. Analyst (SCRAPED → SUMMARIZED + Telegram summaries)
        await runScript('Analyst — analyze + embed + post summaries', 'scripts/analyst-run.ts')

        // 3. Predictor (SUMMARIZED → POSTED + Telegram predictions)
        await runScript('Predictor — generate + post predictions', 'scripts/predictor-run.ts')

        // Record runs
        await prisma.agentConfig.updateMany({
          where: { agentName: { in: ['scout', 'analyst', 'prediction'] } },
          data: { lastRunAt: new Date(), lastError: null },
        }).catch(() => {})

        send('system', '─'.repeat(40))
        send('system', '✅ Pipeline run complete!')
      } catch (err) {
        send('error', `Pipeline error: ${(err as Error).message}`)
      } finally {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      }
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
