#!/usr/bin/env tsx
/**
 * video-analyst.ts — Generate AI summaries for VideoItems that have transcripts.
 *
 * Usage:
 *   npx tsx scripts/video-analyst.ts               # all unsummarized
 *   npx tsx scripts/video-analyst.ts --limit=20    # cap at 20 items
 */
import 'dotenv/config'
import { getScoutDb, disconnectAll } from './lib/prisma.js'
import { chatCompletion } from './lib/openrouter.js'
import { logCost, canSpend, getMonthlySpend } from './lib/budget.js'
import { getModelsForCurrentBudget } from './lib/models.js'
import { pipelineUserIdFromEnv } from './lib/pipeline-scope.js'

const SYSTEM_PROMPT = `You are summarizing a video for someone who didn't watch it.
Write 4-6 sentences covering: the main topic, key insights, any surprising findings,
and practical takeaways. Start directly with the substance — no meta-preamble.
Plain text only, no markdown, no bullet points.`

async function main() {
  const args = Object.fromEntries(
    process.argv.slice(2).map(a => a.replace(/^--/, '').split('='))
  ) as { limit?: string }

  const limit = parseInt(args.limit ?? '30', 10)
  const pipelineUserId = pipelineUserIdFromEnv()
  const db = getScoutDb()

  if (!(await canSpend('video-analyst'))) {
    console.log('[video-analyst] Budget exceeded — skipping')
    await disconnectAll()
    return
  }

  const models = await getModelsForCurrentBudget(getMonthlySpend)
  const model = models.SUMMARIZER
  console.log(`[video-analyst] Model: ${model.name}`)

  const userFilter = pipelineUserId
    ? { channel: { userId: pipelineUserId } }
    : {}

  const toSummarize = await db.videoItem.findMany({
    where: {
      aiSummary: null,
      transcript: { not: null },
      ...userFilter,
    },
    orderBy: { publishedAt: 'desc' },
    take: limit,
    select: { id: true, title: true, description: true, transcript: true, channel: { select: { channelName: true } } },
  })

  console.log(`[video-analyst] ${toSummarize.length} videos to summarize`)

  let processed = 0
  for (const video of toSummarize) {
    try {
      const context = [
        `Channel: ${video.channel.channelName}`,
        `Title: ${video.title}`,
        video.description ? `Description: ${video.description.slice(0, 300)}` : '',
        '',
        'Transcript:',
        video.transcript!.slice(0, 25_000),
      ].filter(Boolean).join('\n')

      const response = await chatCompletion(
        model.id,
        [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: context }],
        { temperature: 0.3, maxTokens: 500, rateLimitFallbackModels: [] },
      )

      await db.videoItem.update({
        where: { id: video.id },
        data: { aiSummary: response.content.trim() },
      })

      await logCost('video-analyst', model, response.promptTokens, response.completionTokens, response.generationId)
      processed++
      console.log(`[video-analyst] ✓ ${video.title.slice(0, 60)}`)
    } catch (err) {
      console.error(`[video-analyst] ✗ ${video.title}: ${(err as Error).message}`)
    }
  }

  console.log(`[video-analyst] Done: ${processed}/${toSummarize.length} summaries generated`)
  await disconnectAll()
}

main().catch(err => {
  console.error('[video-analyst] Fatal:', err)
  process.exit(1)
})
