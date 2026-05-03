import { spawn } from 'child_process'
import { REPO_ROOT } from '@/lib/agents'
import { prisma } from '@/lib/prisma'
import { OWNER_USER_ID } from '@/lib/user'

// POST /api/interests/[id]/github-scan — SSE stream: run github-scout for one interest
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const interest = await prisma.interest.findFirst({ where: { id, userId: OWNER_USER_ID } })
  if (!interest) return new Response('Not found', { status: 404 })

  const { dryRun } = await req.json().catch(() => ({ dryRun: false })) as { dryRun?: boolean }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      function send(type: string, text: string) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, text })}\n\n`))
      }

      send('system', `⭐ GitHub Scout for "${interest.topic}"`)
      send('system', '─'.repeat(50))

      const child = spawn('npx', [
        'tsx', 'scripts/github-scout.ts',
        `--interestId=${id}`,
        ...(dryRun ? ['--dryRun'] : []),
      ], {
        cwd: REPO_ROOT,
        env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      const IGNORED = ["The 'path' argument is deprecated"]

      child.stdout?.on('data', (chunk: Buffer) => {
        chunk.toString().split('\n').filter(l => l.trim()).forEach(l => send('stdout', l))
      })
      child.stderr?.on('data', (chunk: Buffer) => {
        chunk.toString().split('\n')
          .filter(l => l.trim() && !IGNORED.some(s => l.includes(s)))
          .forEach(l => send('stderr', l))
      })
      child.on('close', (code) => {
        send('system', '─'.repeat(50))
        send('system', code === 0 ? '✅ GitHub scan complete! Visit GitHub Feed to see results.' : `✗ Scan failed (exit ${code})`)
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      })
      child.on('error', (err) => {
        send('error', err.message)
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      })
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
