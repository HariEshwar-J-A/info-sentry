#!/usr/bin/env tsx
/**
 * video-analyst.ts — Generate AI summaries for VideoItems.
 *
 * Works with or without transcripts:
 *   - With transcript: detailed summary from full captions text
 *   - Without transcript: summary from title + description metadata
 *
 * Usage:
 *   npx tsx scripts/video-analyst.ts               # all unsummarized
 *   npx tsx scripts/video-analyst.ts --limit=20    # cap at 20 items
 *   npx tsx scripts/video-analyst.ts --all         # include no-transcript videos
 */
import 'dotenv/config'
import { getScoutDb, disconnectAll } from './lib/prisma.js'
import { chatCompletion } from './lib/openrouter.js'
import { logCost, canSpend, getMonthlySpend } from './lib/budget.js'
import { getModelsForCurrentBudget } from './lib/models.js'
import { pipelineUserIdFromEnv } from './lib/pipeline-scope.js'
import { notifyUser } from './lib/push.js'

const TRANSCRIPT_SYSTEM = `You are summarizing a YouTube video for someone who didn't watch it.
Write 4-6 sentences covering: the main topic, key insights, any surprising findings, and practical takeaways.
Start directly with the substance — no meta-preamble like "This video..." or "In this video...".
Plain text only, no markdown, no bullet points.`

const METADATA_SYSTEM = `You are summarizing a YouTube video based on its title and description.
Write 2-3 sentences covering what the video is likely about and who would find it valuable.
Be honest that this is based on metadata only, not the full content.
Start directly with the substance. Plain text only.`

async function main() {
  const args = Object.fromEntries(
    process.argv.slice(2).map(a => a.replace(/^--/, '').split('='))
  ) as { limit?: string; all?: string }

  const limit = parseInt(args.limit ?? '30', 10)
  const includeNoTranscript = args.all === '' || args.all === 'true'
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

  const userFilter = pipelineUserId ? { channel: { userId: pipelineUserId } } : {}

  // Videos with transcripts (priority)
  const withTranscript = await db.videoItem.findMany({
    where: {
      aiSummary: null,
      transcript: { not: null },
      ...userFilter,
    },
    orderBy: { publishedAt: 'desc' },
    take: limit,
    select: {
      id: true, title: true, description: true, transcript: true,
      channel: { select: { channelName: true } },
    },
  })

  // Videos without transcripts (only if --all or no transcript videos available)
  const withoutTranscript = (includeNoTranscript || withTranscript.length === 0)
    ? await db.videoItem.findMany({
        where: {
          aiSummary: null,
          transcript: null,
          description: { not: null },
          ...userFilter,
        },
        orderBy: { publishedAt: 'desc' },
        take: Math.max(0, limit - withTranscript.length),
        select: {
          id: true, title: true, description: true, transcript: true,
          channel: { select: { channelName: true } },
        },
      })
    : []

  const toSummarize = [...withTranscript, ...withoutTranscript]
  console.log(`[video-analyst] ${toSummarize.length} videos to summarize (${withTranscript.length} with transcript, ${withoutTranscript.length} metadata-only)`)

  if (toSummarize.length === 0) {
    console.log('[video-analyst] Hint: run youtube-scout --backfill to fetch missing transcripts first')
    await disconnectAll()
    return
  }

  let processed = 0
  for (const video of toSummarize) {
    try {
      const hasTranscript = !!video.transcript
      const systemPrompt = hasTranscript ? TRANSCRIPT_SYSTEM : METADATA_SYSTEM

      const userContent = hasTranscript
        ? [
            `Channel: ${video.channel.channelName}`,
            `Title: ${video.title}`,
            video.description ? `Description: ${video.description.slice(0, 400)}` : '',
            '',
            'Transcript:',
            video.transcript!.slice(0, 28_000),
          ].filter(Boolean).join('\n')
        : [
            `Channel: ${video.channel.channelName}`,
            `Title: ${video.title}`,
            `Description: ${video.description?.slice(0, 1000) ?? '(none)'}`,
          ].join('\n')

      const response = await chatCompletion(
        model.id,
        [{ role: 'system', content: systemPrompt }, { role: 'user', content: userContent }],
        { temperature: 0.3, maxTokens: hasTranscript ? 500 : 200, rateLimitFallbackModels: [] },
      )

      const aiSummary = response.content.trim()

      await db.videoItem.update({
        where: { id: video.id },
        data: { aiSummary },
      })

      await logCost('video-analyst', model, response.promptTokens, response.completionTokens, response.generationId)
      processed++
      console.log(`[video-analyst] ✓ ${hasTranscript ? '' : '[metadata] '}${video.title.slice(0, 60)}`)

      if (pipelineUserId) {
        await notifyUser(
          db as Parameters<typeof notifyUser>[0],
          pipelineUserId,
          'NEW_VIDEO',
          {
            title: `New video: ${video.title.slice(0, 60)}`,
            body: `${video.channel.channelName} · ${hasTranscript ? 'Full summary' : 'Metadata summary'}`,
            tag: `video-${video.id}`,
            data: { type: 'new_video', videoId: video.id },
          },
          { videoId: video.id },
        ).catch(() => {})
      }
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
