#!/usr/bin/env tsx
/**
 * scout-youtube.ts — Poll YouTube channels via public RSS, extract transcripts,
 *                    and store VideoItems for the video analyst to summarize.
 *
 * Usage:
 *   npx tsx scripts/scout-youtube.ts                    # all active channels
 *   npx tsx scripts/scout-youtube.ts --channelId=<id>  # one channel
 *   npx tsx scripts/scout-youtube.ts --dryRun           # log only
 *
 * YouTube RSS URL format:
 *   https://www.youtube.com/feeds/videos.xml?channel_id=UC...
 *
 * Transcript extraction via yt-dlp (subtitles/auto-generated captions).
 * Falls back gracefully — VideoItem is saved even without a transcript.
 */
import 'dotenv/config'
import { parseStringPromise } from 'xml2js'
import ytdlp from 'yt-dlp-exec'
import { getScoutDb, disconnectAll } from './lib/prisma.js'
import { pipelineUserIdFromEnv } from './lib/pipeline-scope.js'

const MAX_VIDEOS_PER_CHANNEL = parseInt(process.env['MAX_VIDEOS_PER_CHANNEL'] ?? '10', 10)
const MAX_AGE_DAYS = parseInt(process.env['VIDEO_MAX_AGE_DAYS'] ?? '7', 10)
const TRANSCRIPT_TIMEOUT_MS = parseInt(process.env['TRANSCRIPT_TIMEOUT_MS'] ?? '60000', 10)

// ─── RSS Parsing ───────────────────────────────────────────

interface RssEntry {
  'yt:videoId': string[]
  title: string[]
  link: [{ $: { href: string } }]
  published?: string[]
  'media:group'?: [{ 'media:description'?: string[]; 'media:thumbnail'?: [{ $: { url: string } }] }]
}

interface RssFeed {
  feed: {
    entry?: RssEntry[]
    title?: string[]
  }
}

async function fetchRssFeed(rssFeedUrl: string): Promise<RssEntry[]> {
  const res = await fetch(rssFeedUrl, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`RSS fetch failed: ${res.status}`)
  const xml = await res.text()
  const parsed = (await parseStringPromise(xml)) as RssFeed
  return parsed.feed.entry ?? []
}

// ─── Transcript Extraction ─────────────────────────────────

async function extractTranscript(videoUrl: string): Promise<string | null> {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), TRANSCRIPT_TIMEOUT_MS)

    const result = await Promise.race([
      (ytdlp as unknown as (url: string, opts: Record<string, unknown>) => Promise<{ automatic_captions?: Record<string, Array<{ url: string; ext: string }>> }>)(
        videoUrl,
        {
          dumpSingleJson: true,
          writeAutoSub: false,
          skipDownload: true,
          quiet: true,
        }
      ),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), TRANSCRIPT_TIMEOUT_MS)
      ),
    ])
    clearTimeout(timer)

    if (!result) return null

    // Look for English auto-captions
    const captions = result.automatic_captions
    if (!captions) return null

    const langKey = ['en', 'en-US', 'en-GB'].find((k) => captions[k])
    if (!langKey) return null

    const tracks = captions[langKey]!
    const jsonTrack = tracks.find((t) => t.ext === 'json3') ?? tracks[0]
    if (!jsonTrack?.url) return null

    const capRes = await fetch(jsonTrack.url, { signal: AbortSignal.timeout(15_000) })
    if (!capRes.ok) return null

    if (jsonTrack.ext === 'json3') {
      const data = (await capRes.json()) as { events?: Array<{ segs?: Array<{ utf8?: string }> }> }
      const text = (data.events ?? [])
        .flatMap((e) => e.segs ?? [])
        .map((s) => s.utf8 ?? '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
      return text.length > 100 ? text.slice(0, 30_000) : null
    }

    const text = (await capRes.text()).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    return text.length > 100 ? text.slice(0, 30_000) : null
  } catch {
    return null
  }
}

// ─── Process one channel ───────────────────────────────────

async function processChannel(
  db: ReturnType<typeof getScoutDb>,
  channel: { id: string; channelId: string; channelName: string; rssFeedUrl: string | null; channelUrl: string },
  dryRun: boolean,
): Promise<number> {
  const rssFeedUrl =
    channel.rssFeedUrl ??
    `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.channelId}`

  console.log(`\n[youtube] ── "${channel.channelName}" ──`)
  let entries: RssEntry[]
  try {
    entries = await fetchRssFeed(rssFeedUrl)
  } catch (err) {
    console.error(`[youtube]   RSS failed: ${(err as Error).message}`)
    return 0
  }

  const cutoff = new Date(Date.now() - MAX_AGE_DAYS * 86_400_000)
  const fresh = entries
    .filter((e) => {
      const pub = e.published?.[0]
      return pub ? new Date(pub) >= cutoff : true
    })
    .slice(0, MAX_VIDEOS_PER_CHANNEL)

  console.log(`[youtube]   ${fresh.length} recent videos (${entries.length} total in feed)`)

  let saved = 0
  for (const entry of fresh) {
    const videoId = entry['yt:videoId']?.[0]
    if (!videoId) continue

    const title = entry.title?.[0] ?? videoId
    const url = entry.link?.[0]?.$?.href ?? `https://www.youtube.com/watch?v=${videoId}`
    const publishedAt = entry.published?.[0] ? new Date(entry.published[0]) : null
    const description = entry['media:group']?.[0]?.['media:description']?.[0] ?? null
    const thumbnailUrl = entry['media:group']?.[0]?.['media:thumbnail']?.[0]?.$?.url ?? null

    if (dryRun) {
      console.log(`[youtube]   [DRY] ${title}`)
      saved++
      continue
    }

    const existing = await db.videoItem.findUnique({
      where: { channelId_videoId: { channelId: channel.id, videoId } },
      select: { id: true, transcript: true },
    })

    let transcript = existing?.transcript ?? null
    if (!transcript) {
      process.stdout.write(`[youtube]   Extracting captions: ${title.slice(0, 50)}… `)
      transcript = await extractTranscript(url)
      console.log(transcript ? `${transcript.slice(0, 50).replace(/\n/g, ' ')}…` : 'none')
    }

    await db.videoItem.upsert({
      where: { channelId_videoId: { channelId: channel.id, videoId } },
      create: { channelId: channel.id, videoId, title, description, url, thumbnailUrl, publishedAt, transcript },
      update: {
        title,
        description,
        thumbnailUrl,
        publishedAt,
        ...(transcript && !existing?.transcript ? { transcript } : {}),
        updatedAt: new Date(),
      },
    })

    console.log(`[youtube]   ✓ ${existing ? 'updated' : 'saved'}: ${title}${transcript ? ' +transcript' : ''}`)
    saved++
  }

  await db.videoChannel.update({
    where: { id: channel.id },
    data: { lastScanned: new Date(), updatedAt: new Date() },
  })

  return saved
}

// ─── Main ──────────────────────────────────────────────────

async function main() {
  const args = Object.fromEntries(
    process.argv.slice(2).map(a => a.replace(/^--/, '').split('='))
  ) as { channelId?: string; dryRun?: string }

  const dryRun = args.dryRun === '' || args.dryRun === 'true'
  const pipelineUserId = pipelineUserIdFromEnv()
  const db = getScoutDb()

  console.log('[youtube] ═══════════════════════════════════════')
  console.log('[youtube] YouTube Scout')
  if (dryRun) console.log('[youtube] DRY RUN')
  if (pipelineUserId) console.log(`[youtube] User scope: ${pipelineUserId}`)
  console.log('[youtube] ═══════════════════════════════════════')

  const where: Record<string, unknown> = { isActive: true }
  if (args.channelId) where['id'] = args.channelId
  if (pipelineUserId) where['userId'] = pipelineUserId

  const channels = await db.videoChannel.findMany({
    where,
    select: { id: true, channelId: true, channelName: true, rssFeedUrl: true, channelUrl: true },
  })

  console.log(`[youtube] ${channels.length} channel(s) to scan`)

  let total = 0
  for (const channel of channels) {
    try {
      total += await processChannel(db, channel, dryRun)
    } catch (err) {
      console.error(`[youtube] ERROR for "${channel.channelName}": ${(err as Error).message}`)
    }
  }

  console.log('\n[youtube] ═══════════════════════════════════════')
  console.log(`[youtube] Complete — ${total} videos processed`)
  console.log('[youtube] ═══════════════════════════════════════')
  await disconnectAll()
}

main().catch(err => {
  console.error('[youtube] Fatal:', err)
  process.exit(1)
})
