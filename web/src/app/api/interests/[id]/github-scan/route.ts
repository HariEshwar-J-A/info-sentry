import { spawn } from 'child_process'
import path from 'path'
import { REPO_ROOT } from '@/lib/agents'
import { prisma } from '@/lib/prisma'
import { OWNER_USER_ID } from '@/lib/user'

const IGNORED_STDERR = ["The 'path' argument is deprecated", 'Use --trace-deprecation']

// POST /api/interests/[id]/github-scan — SSE: scout → analyst (sequential)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const interest = await prisma.interest.findFirst({ where: { id, userId: OWNER_USER_ID } })
  if (!interest) return new Response('Not found', { status: 404 })

  const { dryRun } = await req.json().catch(() => ({ dryRun: false })) as { dryRun?: boolean }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      function send(type: string, text: string) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, text })}\n\n`))
      }

      function runScript(label: string, scriptFile: string, args: string[] = []): Promise<boolean> {
        return new Promise(resolve => {
          send('system', `\n▶ ${label}`)
          const child = spawn('npx', ['tsx', path.join(REPO_ROOT, scriptFile), ...args], {
            cwd: REPO_ROOT,
            env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
            stdio: ['ignore', 'pipe', 'pipe'],
          })
          child.stdout?.on('data', (chunk: Buffer) => {
            chunk.toString().split('\n').filter(l => l.trim()).forEach(l => send('stdout', l))
          })
          child.stderr?.on('data', (chunk: Buffer) => {
            chunk.toString().split('\n')
              .filter(l => l.trim() && !IGNORED_STDERR.some(s => l.includes(s)))
              .forEach(l => send('stderr', l))
          })
          child.on('close', code => {
            send('system', `✓ ${label} finished (exit ${code ?? 0})`)
            resolve(code === 0)
          })
          child.on('error', err => { send('error', err.message); resolve(false) })
        })
      }

      try {
        send('system', `⭐ GitHub pipeline for "${interest.topic}"`)
        send('system', '─'.repeat(50))

        // Stage 1: Scout — discover repos
        const scoutOk = await runScript(
          'GitHub Scout — find repositories',
          'scripts/github-scout.ts',
          [`--interestId=${id}`, ...(dryRun ? ['--dryRun'] : [])],
        )

        if (scoutOk && !dryRun) {
          // Stage 2: Analyst — generate AI summaries from READMEs
          await runScript(
            'GitHub Analyst — generate AI summaries',
            'scripts/github-analyst.ts',
            [`--interestId=${id}`, '--limit=20'],
          )
        }

        send('system', '─'.repeat(50))
        send('system', '✅ Complete! Visit GitHub Feed to see results with AI summaries.')
      } catch (err) {
        send('error', (err as Error).message)
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
