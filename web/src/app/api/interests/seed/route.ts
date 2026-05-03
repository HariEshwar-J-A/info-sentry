import { spawn } from 'child_process'
import path from 'path'
import { agentProcesses, REPO_ROOT } from '@/lib/agents'

// Trigger a full seed pipeline for a newly added topic:
// scout → analyst → predictor → verifier (optional)
export async function POST(req: Request) {
  const { includeVerifier } = await req.json().catch(() => ({} as { includeVerifier?: boolean }))

  const key = '__seed_pipeline__'
  const existing = agentProcesses.get(key)
  if (existing && existing.exitCode === null) {
    return new Response('Seed pipeline already running', { status: 409 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      function send(type: string, text: string) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, text })}\n\n`))
      }

      send('system', '🌱 Seeding pipeline for new topic…')
      send('system', '─'.repeat(40))

      async function runScript(label: string, scriptFile: string): Promise<boolean> {
        return new Promise((resolve) => {
          send('system', `\n▶ ${label}`)
          const scriptPath = path.join(REPO_ROOT, scriptFile)
          const child = spawn('npx', ['tsx', scriptPath], {
            cwd: REPO_ROOT,
            env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
            stdio: ['ignore', 'pipe', 'pipe'],
          })

          const entry = { process: child, startedAt: new Date(), lines: [] as string[], exitCode: null as number | null }
          agentProcesses.set(key, entry)

          const IGNORED = ["The 'path' argument is deprecated", 'Use --trace-deprecation']

          child.stdout?.on('data', (chunk: Buffer) => {
            chunk.toString().split('\n').filter((l) => l.trim()).forEach((l) => send('stdout', l))
          })
          child.stderr?.on('data', (chunk: Buffer) => {
            chunk.toString().split('\n')
              .filter((l) => l.trim() && !IGNORED.some((s) => l.includes(s)))
              .forEach((l) => send('stderr', l))
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
        await runScript('Scout — fetch latest articles', 'scripts/scout-run.ts')
        await runScript('Analyst — analyze + post summaries', 'scripts/analyst-run.ts')
        await runScript('Predictor — generate + post predictions', 'scripts/predictor-run.ts')
        if (includeVerifier) {
          await runScript('Verifier — check existing predictions', 'scripts/prediction-verifier.ts')
        }

        send('system', '─'.repeat(40))
        send('system', '✅ Topic seed complete! Check the feed for new articles.')
      } catch (err) {
        send('error', `Seed error: ${(err as Error).message}`)
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
