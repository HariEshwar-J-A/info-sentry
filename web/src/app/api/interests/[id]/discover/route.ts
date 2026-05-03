import { spawn } from 'child_process'
import { REPO_ROOT } from '@/lib/agents'
import { prisma } from '@/lib/prisma'
import { OWNER_USER_ID } from '@/lib/user'

const MAX_SOURCES_PER_TOPIC = 50

// POST /api/interests/[id]/discover — run source-discovery.ts via SSE stream
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const interest = await prisma.interest.findFirst({ where: { id, userId: OWNER_USER_ID } })
  if (!interest) return new Response('Not found', { status: 404 })

  // Check hard limit
  const currentCount = await prisma.interestSource.count({ where: { interestId: id } })
  if (currentCount >= MAX_SOURCES_PER_TOPIC) {
    return Response.json({
      error: `Hard limit reached: ${MAX_SOURCES_PER_TOPIC} sources per topic. Remove some sources first.`,
    }, { status: 422 })
  }

  const { dryRun } = await req.json().catch(() => ({ dryRun: false })) as { dryRun?: boolean }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      function send(type: string, text: string) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, text })}\n\n`))
      }

      send('system', `🔍 Discovering sources for "${interest.topic}"…`)
      send('system', `Current: ${currentCount}/${MAX_SOURCES_PER_TOPIC} sources`)
      send('system', '─'.repeat(50))

      const args = [`--interestId=${id}`, ...(dryRun ? ['--dryRun'] : [])]
      const child = spawn('npx', ['tsx', 'scripts/source-discovery.ts', ...args], {
        cwd: REPO_ROOT,
        env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      const IGNORED = ["The 'path' argument is deprecated"]

      child.stdout?.on('data', (chunk: Buffer) => {
        chunk.toString().split('\n').filter(l => l.trim()).forEach(l => {
          // Pass the final JSON result as a special message
          if (l.startsWith('{') && l.includes('"added"')) {
            send('result', l)
          } else {
            send('stdout', l)
          }
        })
      })
      child.stderr?.on('data', (chunk: Buffer) => {
        chunk.toString().split('\n')
          .filter(l => l.trim() && !IGNORED.some(s => l.includes(s)))
          .forEach(l => send('stderr', l))
      })
      child.on('close', (code) => {
        send('system', `─`.repeat(50))
        send('system', code === 0 ? '✅ Discovery complete' : `✗ Discovery failed (exit ${code})`)
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
