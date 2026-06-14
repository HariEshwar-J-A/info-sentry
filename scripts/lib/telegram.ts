/**
 * telegram.ts — Centralized Telegram posting library for all agent scripts.
 *
 * Provides:
 *   postToTopic(name, html, keyboard?)  — post to a named forum topic
 *   postToDM(html)                      — post to admin DM
 *   logAlert(level, msg, context?)      — write to NotificationLog; send to Alerts topic for warn+
 *   postRunLog(entry)                   — structured agent run log to Run-Log topic
 */
import { getScoutDb } from './prisma.js'

const BOT_TOKEN    = process.env['TELEGRAM_BOT_TOKEN']
const SUPERGROUP   = process.env['TELEGRAM_SUPERGROUP_ID']
const ADMIN_ID     = process.env['TELEGRAM_ADMIN_ID']

export type NotificationLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical'

export interface RunLogEntry {
  agent:       string
  startedAt:   Date
  durationMs:  number
  succeeded:   number
  skipped?:    number
  failed:      number
  errors?:     string[]
  costUsd?:    number
  model?:      string
  exitCode?:   number | null
}

export interface InlineButton {
  text:          string
  callback_data: string
}

// ─── Topic thread ID cache (process-lifetime) ──────────────────────────────

const threadIdCache = new Map<string, number | null>()

async function getTopicThreadId(topicName: string): Promise<number | null> {
  if (threadIdCache.has(topicName)) return threadIdCache.get(topicName)!
  const db = getScoutDb()
  const topic = await db.forumTopic.findUnique({ where: { name: topicName } })
  const id = topic?.telegramTopicId ?? null
  threadIdCache.set(topicName, id)
  return id
}

// ─── Core API wrapper ──────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

export async function telegramApi(
  method: string,
  body: Record<string, unknown>,
  retries = 3,
): Promise<unknown> {
  if (!BOT_TOKEN) return null
  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })
    const data = (await res.json()) as {
      ok: boolean
      result?: unknown
      description?: string
      parameters?: { retry_after?: number }
    }
    if (data.ok) return data.result

    const retryAfter = data.parameters?.retry_after
    if (retryAfter && attempt < retries - 1) {
      await sleep(retryAfter * 1000 + 500)
      continue
    }
    // Log but don't throw — Telegram errors should never crash an agent run
    console.warn(`[telegram] ${method} failed: ${data.description ?? 'unknown'}`)
    return null
  }
  return null
}

export function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ─── Public send helpers ───────────────────────────────────────────────────

export async function postToTopic(
  topicName: string,
  html: string,
  keyboard?: InlineButton[][],
): Promise<void> {
  if (!BOT_TOKEN || !SUPERGROUP) return
  const threadId = await getTopicThreadId(topicName)

  const body: Record<string, unknown> = {
    chat_id:                SUPERGROUP,
    text:                   html.slice(0, 4096),
    parse_mode:             'HTML',
    disable_web_page_preview: true,
  }
  if (threadId !== null) body['message_thread_id'] = threadId
  if (keyboard && keyboard.length > 0) body['reply_markup'] = { inline_keyboard: keyboard }

  await telegramApi('sendMessage', body)
}

export async function postToDM(html: string): Promise<void> {
  if (!BOT_TOKEN || !ADMIN_ID) return
  await telegramApi('sendMessage', {
    chat_id:    ADMIN_ID,
    text:       html.slice(0, 4096),
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  })
}

// ─── Alert logger ──────────────────────────────────────────────────────────

export async function logAlert(
  level: NotificationLevel,
  message: string,
  context?: Record<string, unknown>,
): Promise<void> {
  // Persist to NotificationLog
  try {
    const db = getScoutDb()
    const sendViaBot = level === 'warn' || level === 'error' || level === 'critical'
    await db.notificationLog.create({
      data: {
        level,
        channel: sendViaBot ? 'Alerts' : 'none',
        message: context ? `${message}\n${JSON.stringify(context)}` : message,
        sent: sendViaBot,
      },
    })
  } catch { /* non-fatal */ }

  // Only push to Telegram for warn/error/critical
  if (level !== 'warn' && level !== 'error' && level !== 'critical') return

  const emoji = level === 'critical' ? '🚨' : level === 'error' ? '❌' : '⚠️'
  const ctx = context ? `\n<pre>${escHtml(JSON.stringify(context, null, 2).slice(0, 300))}</pre>` : ''
  const text = `${emoji} <b>${level.toUpperCase()}</b>: ${escHtml(message)}${ctx}`

  await postToTopic('Alerts', text)
}

// ─── Run log poster ────────────────────────────────────────────────────────

export async function postRunLog(entry: RunLogEntry): Promise<void> {
  const durationSec = Math.round(entry.durationMs / 1000)
  const durationStr = durationSec >= 60
    ? `${Math.floor(durationSec / 60)}m ${durationSec % 60}s`
    : `${durationSec}s`

  const timeStr = entry.startedAt.toLocaleString('en-CA', {
    timeZone: 'America/Toronto',
    month:    'short',
    day:      '2-digit',
    hour:     '2-digit',
    minute:   '2-digit',
    hour12:   false,
  })

  const agentLabel = entry.agent.charAt(0).toUpperCase() + entry.agent.slice(1)

  const lines: string[] = [
    `<b>📋 ${escHtml(agentLabel)} Run</b> — ${escHtml(timeStr)} ET · ${durationStr}`,
  ]

  if (entry.succeeded > 0) lines.push(`✅ ${entry.succeeded} succeeded`)
  if ((entry.skipped ?? 0) > 0) lines.push(`⏭️  ${entry.skipped} skipped`)
  if (entry.failed > 0) lines.push(`❌ ${entry.failed} failed`)
  if (entry.failed === 0 && entry.succeeded === 0 && !entry.skipped) {
    lines.push('⏭️  Nothing to process')
  }

  if (entry.errors && entry.errors.length > 0) {
    for (const e of entry.errors.slice(0, 3)) {
      lines.push(`   └ ${escHtml(e.slice(0, 120))}`)
    }
  }

  if (entry.costUsd !== undefined && entry.costUsd > 0) {
    const modelPart = entry.model ? `  |  Model: ${escHtml(entry.model)}` : ''
    lines.push(`💰 Cost: $${entry.costUsd.toFixed(4)}${modelPart}`)
  }

  // Flush any pending UserActivityLog entries since the run started
  try {
    const db = getScoutDb()
    const since = new Date(entry.startedAt.getTime() - 30 * 60 * 1000) // 30 min window
    const activity = await db.userActivityLog.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'asc' },
      take: 10,
    })
    if (activity.length > 0) {
      lines.push('')
      lines.push('<b>👤 User Activity</b>')
      for (const a of activity) {
        const when = a.createdAt.toLocaleTimeString('en-CA', { timeZone: 'America/Toronto', hour: '2-digit', minute: '2-digit', hour12: false })
        const who = a.email ? escHtml(a.email.split('@')[0] ?? a.email) : 'user'
        const detail = a.detail ? ` — ${escHtml(a.detail.slice(0, 80))}` : ''
        lines.push(`  ${when} ${who} ${escHtml(a.action)}${detail}`)
      }
    }
  } catch { /* non-fatal */ }

  await postToTopic('Run-Log', lines.join('\n'))
}
