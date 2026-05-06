import { prisma } from '@/lib/prisma'
import { requireUserId } from '@/lib/user'
import { getRunSnapshot } from '@/lib/pipelineRuns'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUserId()
  if (auth instanceof Response) return auth
  const { userId } = auth
  const { id } = await params

  const run = await prisma.pipelineRun.findFirst({
    where: { id, interest: { userId } },
    select: { id: true, status: true, logTail: true },
  })
  if (!run) return new Response('Not found', { status: 404 })

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      const send = (line: string) => controller.enqueue(encoder.encode(`data: ${line}\n\n`))
      const state = getRunSnapshot(id)

      if (!state) {
        ;(run.logTail ?? '').split('\n').filter(Boolean).forEach((line) => send(line))
        send('[DONE]')
        controller.close()
        return
      }

      let idx = 0
      const emitNew = () => {
        const latest = getRunSnapshot(id)
        if (!latest) return
        while (idx < latest.logs.length) {
          const line = latest.logs[idx++]
          send(`[${line.type}] ${line.text}`)
        }
        if (latest.done) {
          send('[DONE]')
          clearInterval(timer)
          controller.close()
        }
      }

      emitNew()
      const timer = setInterval(emitNew, 1000)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
