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
 * Transcript extraction: fetches the YouTube watch page, extracts the caption
 * track URL from ytInitialPlayerResponse, then fetches and parses the XML/JSON3
 * caption file. No yt-dlp binary required.
 */
import 'dotenv/config'
import { parseStringPromise } from 'xml2js'
import { getScoutDb, disconnectAll } from './lib/prisma.js'
import { pipelineUserIdFromEnv } from './lib/pipeline-scope.js'

const MAX_VIDEOS_PER_CHANNEL = parseInt(process.env['MAX_VIDEOS_PER_CHANNEL'] ?? '10', 10)
const MAX_AGE_DAYS = parseInt(process.env['VIDEO_MAX_AGE_DAYS'] ?? '7', 10)
const TRANSCRIPT_TIMEOUT_MS = parseInt(process.env['TRANSCRIPT_TIMEOUT_MS'] ?? '20000', 10)

const YT_HEADERS: HeadersInit = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
}

// ─── RSS Parsing ───────────────────────────────────────────

interface RssEntry {
  'yt:videoId': string[]
  title: string[]
  link: [{ $: { href: string } }]
  published?: string[]
  'media:group'?: [{
    'media:description'?: string[]
    'media:thumbnail'?: [{ $: { url: string } }]
  }]
}

interface RssFeed { feed: { entry?: RssEntry[] } }

async function fetchRssFeed(rssFeedUrl: string): Promise<RssEntry[]> {
  const res = await fetch(rssFeedUrl, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`RSS fetch failed: ${res.status}`)
  const xml = await res.text()
  const parsed = (await parseStringPromise(xml)) as RssFeed
  return parsed.feed.entry ?? []
}

// ─── Transcript Extraction ─────────────────────────────────
// Uses YouTube's internal caption track URL — no binary required.

async function extractTranscript(videoId: string): Promise<string | null> {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), TRANSCRIPT_TIMEOUT_MS)

    // 1. Fetch watch page and extract ytInitialPlayerResponse
    const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: YT_HEADERS,
      signal: ctrl.signal,
    })
    clearTimeout(timer)
    if (!pageRes.ok) return null

    const html = await pageRes.text()

    // 2. Pull out the playerResponse JSON blob (3 possible patterns)
    let playerJson: string | undefined
    const m1 = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});(?:\s*(?:var|const|let)\s|\s*<\/script>)/)
    if (m1) playerJson = m1[1]
    if (!playerJson) {
      const m2 = html.match(/ytInitialPlayerResponse\s*=\s*(\{[\s\S]+?\});\s*(?:var|if|window)/)
      if (m2) playerJson = m2[1]
    }
    if (!playerJson) return null

    let player: { captions?: { playerCaptionsTracklistRenderer?: { captionTracks?: Array<{ baseUrl: string; languageCode: string; kind?: string }> } } }
    try { player = JSON.parse(playerJson) } catch { return null }

    const tracks = player?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? []
    if (tracks.length === 0) return null

    // 3. Prefer English manual captions, then English auto-generated, then any
    const preferred =
      tracks.find(t => t.languageCode === 'en' && t.kind !== 'asr') ??
      tracks.find(t => t.languageCode === 'en') ??
      tracks.find(t => t.languageCode?.startsWith('en')) ??
      tracks[0]

    if (!preferred?.baseUrl) return null

    // 4. Fetch caption XML (json3 format is cleanest)
    const captionUrl = preferred.baseUrl.includes('fmt=') ? preferred.baseUrl : preferred.baseUrl + '&fmt=json3'
    const ctrl2 = new AbortController()
    const timer2 = setTimeout(() => ctrl2.abort(), 10_000)
    const capRes = await fetch(captionUrl, { signal: ctrl2.signal })
    clearTimeout(timer2)
    if (!capRes.ok) return null

    // 5. Parse json3 caption format
    const data = (await capRes.json()) as { events?: Array<{ segs?: Array<{ utf8?: string }> }> }
    const text = (data.events ?? [])
      .flatMap(e => e.segs ?? [])
      .map(s => s.utf8 ?? '')
      .join(' ')
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    return text.length > 100 ? text.slice(0, 40_000) : null
  } catch {
    return null
  }
}

// ─── RSS entry helpers ─────────────────────────────────────

function extractVideoMeta(entry: RssEntry) {
  const videoId = entry['yt:videoId']?.[0] ?? ''
  const title = entry.title?.[0] ?? videoId
  const url = entry.link?.[0]?.$?.href ?? `https://www.youtube.com/watch?v=${videoId}`
  const publishedAt = entry.published?.[0] ? new Date(entry.published[0]) : null
  const description = entry['media:group']?.[0]?.['media:description']?.[0] ?? null
  const thumbnailUrl = entry['media:group']?.[0]?.['media:thumbnail']?.[0]?.$?.url ?? null
  return { videoId, title, url, publishedAt, description, thumbnailUrl }
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
    .filter(e => {
      const pub = e.published?.[0]
      return pub ? new Date(pub) >= cutoff : true
    })
    .slice(0, MAX_VIDEOS_PER_CHANNEL)

  console.log(`[youtube]   ${fresh.length} recent videos (${entries.length} total in feed)`)

  let saved = 0
  for (const entry of fresh) {
    const meta = extractVideoMeta(entry)
    if (!meta.videoId) continue

    if (dryRun) {
      console.log(`[youtube]   [DRY] ${meta.title}`)
      saved++
      continue
    }

    const existing = await db.videoItem.findUnique({
      where: { channelId_videoId: { channelId: channel.id, videoId: meta.videoId } },
      select: { id: true, transcript: true },
    })

    // Fetch transcript for new videos OR ones still missing it
    let transcript = existing?.transcript ?? null
    if (!transcript) {
      process.stdout.write(`[youtube]   Fetching transcript: ${meta.title.slice(0, 50)}… `)
      transcript = await extractTranscript(meta.videoId)
      console.log(transcript
        ? `${transcript.slice(0, 60).replace(/\n/g, ' ')}…`
        : 'not available')
    }

    await db.videoItem.upsert({
      where: { channelId_videoId: { channelId: channel.id, videoId: meta.videoId } },
      create: {
        channelId: channel.id,
        videoId: meta.videoId,
        title: meta.title,
        description: meta.description,
        url: meta.url,
        thumbnailUrl: meta.thumbnailUrl,
        publishedAt: meta.publishedAt,
        transcript,
      },
      update: {
        title: meta.title,
        description: meta.description,
        thumbnailUrl: meta.thumbnailUrl,
        publishedAt: meta.publishedAt,
        ...(transcript && !existing?.transcript ? { transcript } : {}),
        updatedAt: new Date(),
      },
    })

    const action = existing ? 'updated' : 'saved'
    console.log(`[youtube]   ✓ ${action}: ${meta.title.slice(0, 60)}${transcript ? ' +transcript' : ''}`)
    saved++
  }

  await db.videoChannel.update({
    where: { id: channel.id },
    data: { lastScanned: new Date(), updatedAt: new Date() },
  })

  return saved
}

// ─── Backfill transcripts for existing videos ──────────────

async function backfillTranscripts(db: ReturnType<typeof getScoutDb>, userId: string | null): Promise<void> {
  const where = {
    transcript: null,
    ...(userId ? { channel: { userId } } : {}),
  }
  const missing = await db.videoItem.findMany({ where, select: { id: true, videoId: true, title: true }, take: 20 })
  if (missing.length === 0) return

  console.log(`\n[youtube] Backfilling transcripts for ${missing.length} existing videos…`)
  for (const v of missing) {
    process.stdout.write(`[youtube]   ${v.title.slice(0, 50)}… `)
    const transcript = await extractTranscript(v.videoId)
    if (transcript) {
      await db.videoItem.update({ where: { id: v.id }, data: { transcript } })
      console.log(`${transcript.slice(0, 50).replace(/\n/g, ' ')}…`)
    } else {
      console.log('not available')
    }
  }
}

// ─── Main ──────────────────────────────────────────────────

async function main() {
  const args = Object.fromEntries(
    process.argv.slice(2).map(a => a.replace(/^--/, '').split('='))
  ) as { channelId?: string; dryRun?: string; backfill?: string }

  const dryRun = args.dryRun === '' || args.dryRun === 'true'
  const pipelineUserId = pipelineUserIdFromEnv()
  const db = getScoutDb()

  console.log('[youtube] ═══════════════════════════════════════')
  console.log('[youtube] YouTube Scout')
  if (dryRun) console.log('[youtube] DRY RUN')
  if (pipelineUserId) console.log(`[youtube] User scope: ${pipelineUserId}`)
  console.log('[youtube] ═══════════════════════════════════════')

  // Optionally backfill transcripts for existing videos first
  if (args.backfill === '' || args.backfill === 'true') {
    await backfillTranscripts(db, pipelineUserId)
  }

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
