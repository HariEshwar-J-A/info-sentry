#!/usr/bin/env tsx
/**
 * scout-youtube.ts — Poll YouTube channels via public RSS, extract transcripts,
 *                    and store VideoItems for the video analyst to summarize.
 *
 * Transcript sources (per channel setting):
 *   "youtube"  → try YouTube's signed caption track URL (free, fast)
 *   "whisper"  → download audio with yt-dlp → transcribe via Groq Whisper or OpenAI Whisper
 *   "none"     → skip transcript entirely
 *
 * Audio transcription key priority: GROQ_API_KEY → OPENAI_API_KEY
 *
 * Usage:
 *   npx tsx scripts/scout-youtube.ts
 *   npx tsx scripts/scout-youtube.ts --backfill   # retry missing transcripts
 *   npx tsx scripts/scout-youtube.ts --dryRun
 */
import 'dotenv/config'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseStringPromise } from 'xml2js'
import { getScoutDb, disconnectAll } from './lib/prisma.js'
import { pipelineUserIdFromEnv } from './lib/pipeline-scope.js'

const exec = promisify(execFile)

const MAX_VIDEOS_PER_CHANNEL = parseInt(process.env['MAX_VIDEOS_PER_CHANNEL'] ?? '10', 10)

// Audio transcription: prefer Groq (free, fast) over OpenAI
const GROQ_API_KEY = process.env['GROQ_API_KEY'] ?? ''
const OPENAI_API_KEY = process.env['OPENAI_API_KEY'] ?? ''
const WHISPER_API_KEY = GROQ_API_KEY || OPENAI_API_KEY
const WHISPER_ENDPOINT = GROQ_API_KEY
  ? 'https://api.groq.com/openai/v1/audio/transcriptions'
  : 'https://api.openai.com/v1/audio/transcriptions'
const WHISPER_MODEL = GROQ_API_KEY ? 'whisper-large-v3-turbo' : 'whisper-1'

const YTDLP_BIN = process.env['YTDLP_PATH'] ?? '/opt/homebrew/bin/yt-dlp'

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
  'media:group'?: [{ 'media:description'?: string[]; 'media:thumbnail'?: [{ $: { url: string } }] }]
}
interface RssFeed { feed: { entry?: RssEntry[] } }

async function fetchRssFeed(rssFeedUrl: string): Promise<RssEntry[]> {
  const res = await fetch(rssFeedUrl, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`RSS fetch failed: ${res.status}`)
  const parsed = (await parseStringPromise(await res.text())) as RssFeed
  return parsed.feed.entry ?? []
}

function extractVideoMeta(entry: RssEntry) {
  return {
    videoId: entry['yt:videoId']?.[0] ?? '',
    title: entry.title?.[0] ?? '',
    url: entry.link?.[0]?.$?.href ?? '',
    publishedAt: entry.published?.[0] ? new Date(entry.published[0]) : null,
    description: entry['media:group']?.[0]?.['media:description']?.[0] ?? null,
    thumbnailUrl: entry['media:group']?.[0]?.['media:thumbnail']?.[0]?.$?.url ?? null,
  }
}

// ─── JSON extractor: brace-balanced ───────────────────────
// Properly extracts a JSON object even when it spans thousands of lines.

function extractJsonByKey(html: string, varName: string): unknown | null {
  const marker = `${varName} = {`
  const startIdx = html.indexOf(marker)
  if (startIdx === -1) return null
  let braces = 0, i = startIdx + marker.length - 1, inStr = false, esc = false
  while (i < html.length) {
    const c = html[i]
    if (esc) { esc = false; i++; continue }
    if (c === '\\' && inStr) { esc = true; i++; continue }
    if (c === '"') { inStr = !inStr; i++; continue }
    if (!inStr) {
      if (c === '{') braces++
      else if (c === '}') { braces--; if (braces === 0) break }
    }
    i++
  }
  try { return JSON.parse(html.slice(startIdx + marker.length - 1, i + 1)) }
  catch { return null }
}

// ─── YouTube caption track extraction ─────────────────────

async function extractYouTubeTranscript(videoId: string): Promise<string | null> {
  try {
    const pageUrl = `https://www.youtube.com/watch?v=${videoId}`
    const res = await fetch(pageUrl, { headers: YT_HEADERS, signal: AbortSignal.timeout(15_000) })
    if (!res.ok) return null
    const html = await res.text()

    // Use brace-balanced extractor for reliable parsing
    const player = extractJsonByKey(html, 'ytInitialPlayerResponse') as {
      captions?: { playerCaptionsTracklistRenderer?: { captionTracks?: Array<{ baseUrl: string; languageCode: string; kind?: string }> } }
    } | null
    const tracks = player?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? []
    if (tracks.length === 0) return null

    // Prefer manual English → auto English → any English → first track
    const track =
      tracks.find(t => t.languageCode === 'en' && t.kind !== 'asr') ??
      tracks.find(t => t.languageCode === 'en') ??
      tracks.find(t => t.languageCode?.startsWith('en')) ??
      tracks[0]

    if (!track?.baseUrl) return null

    const capUrl = track.baseUrl.includes('fmt=') ? track.baseUrl : `${track.baseUrl}&fmt=json3`

    // Fetch caption using same-origin headers to avoid 429
    const capRes = await fetch(capUrl, {
      headers: { ...YT_HEADERS, Referer: pageUrl },
      signal: AbortSignal.timeout(12_000),
    })
    if (!capRes.ok) return null

    const data = (await capRes.json()) as { events?: Array<{ segs?: Array<{ utf8?: string }> }> }
    const text = (data.events ?? [])
      .flatMap(e => e.segs ?? [])
      .map(s => s.utf8 ?? '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()

    return text.length > 100 ? text.slice(0, 40_000) : null
  } catch {
    return null
  }
}

// ─── Whisper audio transcription ──────────────────────────

async function extractWhisperTranscript(videoId: string): Promise<string | null> {
  if (!WHISPER_API_KEY) {
    console.warn('[youtube]   Whisper: no GROQ_API_KEY or OPENAI_API_KEY set — skipping')
    return null
  }

  const tmpDir = await mkdtemp(join(tmpdir(), 'yt-audio-'))
  const outPath = join(tmpDir, `${videoId}.mp3`)

  try {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`
    process.stdout.write(`[youtube]   Whisper: downloading audio… `)

    await exec(YTDLP_BIN, [
      '-x', '--audio-format', 'mp3', '--audio-quality', '64K',
      '--no-playlist', '--max-filesize', '25m',
      '-o', outPath,
      '--quiet',
      videoUrl,
    ], { timeout: 120_000 })

    const audioBuffer = await readFile(outPath)
    const sizeKB = Math.round(audioBuffer.length / 1024)
    process.stdout.write(`${sizeKB}KB → transcribing… `)

    // Send to OpenAI Whisper
    const form = new FormData()
    form.append('model', WHISPER_MODEL)
    form.append('response_format', 'text')
    form.append('language', 'en')
    form.append('file', new Blob([audioBuffer], { type: 'audio/mpeg' }), `${videoId}.mp3`)

    const whisperRes = await fetch(WHISPER_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${WHISPER_API_KEY}` },
      body: form,
      signal: AbortSignal.timeout(300_000),
    })

    if (!whisperRes.ok) {
      const err = await whisperRes.text()
      console.log(`failed (${whisperRes.status}: ${err.slice(0, 80)})`)
      return null
    }

    const transcript = (await whisperRes.text()).trim()
    console.log(`done (${transcript.split(/\s+/).length} words)`)
    return transcript.length > 100 ? transcript.slice(0, 40_000) : null
  } catch (err) {
    console.log(`error: ${(err as Error).message.split('\n')[0]}`)
    return null
  } finally {
    await rm(tmpDir, { recursive: true, force: true })
  }
}

// ─── Per-video transcript extraction ──────────────────────

async function fetchTranscript(videoId: string, source: string): Promise<string | null> {
  if (source === 'none') return null
  if (source === 'whisper') return extractWhisperTranscript(videoId)

  // "youtube" — try captions first, fall back to whisper if key available
  const yt = await extractYouTubeTranscript(videoId)
  if (yt) return yt
  if (WHISPER_API_KEY) {
    console.log('[youtube]   YouTube captions unavailable — trying Whisper fallback…')
    return extractWhisperTranscript(videoId)
  }
  return null
}

// ─── Process one channel ───────────────────────────────────

async function processChannel(
  db: ReturnType<typeof getScoutDb>,
  channel: {
    id: string; channelId: string; channelName: string
    rssFeedUrl: string | null; channelUrl: string
    transcriptSource: string; maxAgeDays: number
  },
  dryRun: boolean,
): Promise<number> {
  const rssFeedUrl = channel.rssFeedUrl ??
    `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.channelId}`

  console.log(`\n[youtube] ── "${channel.channelName}" (transcript: ${channel.transcriptSource}) ──`)

  let entries: RssEntry[]
  try { entries = await fetchRssFeed(rssFeedUrl) }
  catch (err) { console.error(`[youtube]   RSS failed: ${(err as Error).message}`); return 0 }

  const cutoff = new Date(Date.now() - channel.maxAgeDays * 86_400_000)
  const fresh = entries
    .filter(e => { const pub = e.published?.[0]; return pub ? new Date(pub) >= cutoff : true })
    .slice(0, MAX_VIDEOS_PER_CHANNEL)

  console.log(`[youtube]   ${fresh.length} videos within ${channel.maxAgeDays}d (${entries.length} total in feed)`)

  let saved = 0
  for (const entry of fresh) {
    const meta = extractVideoMeta(entry)
    if (!meta.videoId) continue

    if (dryRun) { console.log(`[youtube]   [DRY] ${meta.title}`); saved++; continue }

    const existing = await db.videoItem.findUnique({
      where: { channelId_videoId: { channelId: channel.id, videoId: meta.videoId } },
      select: { id: true, transcript: true },
    })

    let transcript = existing?.transcript ?? null
    if (!transcript) {
      process.stdout.write(`[youtube]   Transcript (${channel.transcriptSource}): ${meta.title.slice(0, 45)}… `)
      transcript = await fetchTranscript(meta.videoId, channel.transcriptSource)
      if (!transcript) console.log('not available')
    }

    await db.videoItem.upsert({
      where: { channelId_videoId: { channelId: channel.id, videoId: meta.videoId } },
      create: { channelId: channel.id, videoId: meta.videoId, ...meta, transcript },
      update: {
        title: meta.title, description: meta.description, thumbnailUrl: meta.thumbnailUrl,
        publishedAt: meta.publishedAt,
        ...(transcript && !existing?.transcript ? { transcript } : {}),
        updatedAt: new Date(),
      },
    })

    const label = existing ? 'updated' : 'saved'
    console.log(`[youtube]   ✓ ${label}: ${meta.title.slice(0, 55)}${transcript ? ' +transcript' : ''}`)
    saved++
  }

  await db.videoChannel.update({ where: { id: channel.id }, data: { lastScanned: new Date() } })
  return saved
}

// ─── Backfill: retry transcripts for existing videos ──────

async function backfillTranscripts(
  db: ReturnType<typeof getScoutDb>,
  userId: string | null,
): Promise<void> {
  const channels = await db.videoChannel.findMany({
    where: { isActive: true, transcriptSource: { not: 'none' }, ...(userId ? { userId } : {}) },
    select: { id: true, channelName: true, transcriptSource: true },
  })

  for (const ch of channels) {
    const missing = await db.videoItem.findMany({
      where: { channelId: ch.id, transcript: null },
      select: { id: true, videoId: true, title: true },
      take: 20,
    })
    if (missing.length === 0) continue

    console.log(`\n[youtube] Backfilling ${missing.length} transcripts for "${ch.channelName}"…`)
    for (const v of missing) {
      process.stdout.write(`[youtube]   ${v.title.slice(0, 50)}… `)
      const transcript = await fetchTranscript(v.videoId, ch.transcriptSource)
      if (transcript) {
        await db.videoItem.update({ where: { id: v.id }, data: { transcript } })
      } else {
        console.log('not available')
      }
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
  const whisperProvider = GROQ_API_KEY ? 'Groq (whisper-large-v3-turbo)' : OPENAI_API_KEY ? 'OpenAI (whisper-1)' : 'not configured — set GROQ_API_KEY or OPENAI_API_KEY'
  console.log(`[youtube] Whisper: ${whisperProvider}`)
  console.log('[youtube] ═══════════════════════════════════════')

  if (args.backfill === '' || args.backfill === 'true') {
    await backfillTranscripts(db, pipelineUserId)
  }

  const where: Record<string, unknown> = { isActive: true }
  if (args.channelId) where['id'] = args.channelId
  if (pipelineUserId) where['userId'] = pipelineUserId

  const channels = await db.videoChannel.findMany({
    where,
    select: { id: true, channelId: true, channelName: true, rssFeedUrl: true, channelUrl: true, transcriptSource: true, maxAgeDays: true },
  })

  console.log(`[youtube] ${channels.length} channel(s) to scan`)

  let total = 0
  for (const channel of channels) {
    try { total += await processChannel(db, channel, dryRun) }
    catch (err) { console.error(`[youtube] ERROR for "${channel.channelName}": ${(err as Error).message}`) }
  }

  console.log('\n[youtube] ═══════════════════════════════════════')
  console.log(`[youtube] Complete — ${total} videos processed`)
  console.log('[youtube] ═══════════════════════════════════════')
  await disconnectAll()
}

main().catch(err => { console.error('[youtube] Fatal:', err); process.exit(1) })
