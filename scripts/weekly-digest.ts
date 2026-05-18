#!/usr/bin/env tsx
/**
 * weekly-digest.ts — Weekly intelligence recap posted to Telegram.
 *
 * Covers: top articles of the week, prediction activity, budget summary,
 * and a "what you missed" section for articles viewed <50% of the week.
 *
 * Usage:
 *   npx tsx scripts/weekly-digest.ts           # send digest
 *   npx tsx scripts/weekly-digest.ts --force   # skip dedup check
 *
 * Recommended cron: 0 19 * * 0 (Sundays at 7pm)
 */
import 'dotenv/config'
import { getScoutDb, disconnectAll } from './lib/prisma.js'
import { chatCompletion } from './lib/openrouter.js'
import { canSpend, getMonthlySpend } from './lib/budget.js'
import { getModelsForCurrentBudget } from './lib/models.js'
import { pipelineUserIdFromEnv } from './lib/pipeline-scope.js'

const BOT_TOKEN = process.env['TELEGRAM_BOT_TOKEN']
const ADMIN_ID  = process.env['TELEGRAM_ADMIN_ID']

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

async function sendTelegram(text: string): Promise<void> {
  if (!BOT_TOKEN || !ADMIN_ID) { console.log('[weekly-digest] No Telegram config — skipping send'); return }
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: ADMIN_ID, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  })
  const data = (await res.json()) as { ok: boolean; description?: string }
  if (!data.ok) console.warn(`[weekly-digest] Telegram failed: ${data.description}`)
}

async function generateWeeklyDigest(
  db: ReturnType<typeof getScoutDb>,
  userId: string | null,
  force: boolean,
  modelId: string,
): Promise<void> {
  // Dedup: skip if already sent this week
  if (!force) {
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()) // last Sunday
    weekStart.setHours(0, 0, 0, 0)
    const existing = await db.notification.findFirst({
      where: { ...(userId ? { userId } : {}), type: 'SYSTEM', title: { startsWith: 'Weekly Digest' }, createdAt: { gte: weekStart } },
    })
    if (existing) { console.log('[weekly-digest] Already sent this week — use --force to resend'); return }
  }

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  // Fetch stats for the week
  const [
    articlesThisWeek,
    predictionsThisWeek,
    resolvedThisWeek,
    topArticles,
    userInterests,
    budget,
  ] = await Promise.all([
    db.article.count({ where: { scrapedAt: { gte: since }, status: { in: ['SUMMARIZED', 'POSTED'] } } }),
    db.prediction.count({ where: { createdAt: { gte: since } } }),
    db.prediction.count({ where: { updatedAt: { gte: since }, status: { in: ['CORRECT', 'INCORRECT', 'PARTIALLY_CORRECT'] } } }),
    // Top articles by relevance this week
    db.article.findMany({
      where: {
        scrapedAt: { gte: since },
        status: { in: ['SUMMARIZED', 'POSTED'] },
        ...(userId ? { source: { interests: { some: { interest: { userId, isActive: true } } } } } : {}),
        summary: { isNot: null },
      },
      include: { summary: { select: { content: true, keyTopics: true, relevanceScore: true } } },
      orderBy: { summary: { relevanceScore: 'desc' } },
      take: 10,
    }),
    userId ? db.interest.findMany({ where: { userId, isActive: true }, select: { topic: true, score: true }, orderBy: { score: 'desc' }, take: 5 }) : [],
    (async () => {
      const now = new Date()
      const month = now.getMonth() + 1
      const year = now.getFullYear()
      const [bs, cl] = await Promise.all([
        db.budgetStatus.findUnique({ where: { year_month: { year, month } } }),
        db.costLog.aggregate({ where: { createdAt: { gte: new Date(year, month - 1, 1) } }, _sum: { totalCostUsd: true } }),
      ])
      const spent = cl._sum.totalCostUsd ?? 0
      const limit = bs?.budgetUsd ?? 7.3
      return { spent, limit, pct: Math.round((spent / limit) * 100) }
    })(),
  ])

  const weekLabel = since.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' – ' + new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  // Build LLM context from top articles
  const topicsTracked = userInterests.map(i => i.topic).join(', ') || 'general news'
  const articleList = topArticles.slice(0, 6).map((a, i) =>
    `[${i + 1}] ${a.title}\n${a.summary?.content?.slice(0, 300) ?? ''}`
  ).join('\n\n')

  let aiNarrative = ''
  if (topArticles.length >= 2 && await canSpend('weekly-digest')) {
    const systemPrompt = `You are writing a concise weekly intelligence recap for a professional reader.
Write 3-4 sentences covering the most significant developments from this week across the tracked topics.
Start with the most impactful story. Be concrete about what happened and why it matters.
Plain text only, no bullet points, no markdown.`

    const userPrompt = `Week: ${weekLabel}. Topics tracked: ${topicsTracked}.

Top articles this week:
${articleList}

Write a 3-4 sentence recap of the most significant developments.`

    try {
      const resp = await chatCompletion(modelId, [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ], { temperature: 0.4, maxTokens: 300, rateLimitFallbackModels: [] })
      aiNarrative = resp.content.trim()
    } catch (err) {
      console.warn(`[weekly-digest] LLM failed: ${(err as Error).message}`)
    }
  }

  // Build Telegram message
  const lines: string[] = [
    `<b>Weekly Digest</b> — ${escHtml(weekLabel)}`,
    '',
  ]

  if (aiNarrative) {
    lines.push(escHtml(aiNarrative), '')
  }

  lines.push('<b>This week:</b>')
  lines.push(`• ${articlesThisWeek} articles analyzed`)
  lines.push(`• ${predictionsThisWeek} new predictions`)
  if (resolvedThisWeek > 0) lines.push(`• ${resolvedThisWeek} predictions resolved`)
  lines.push(`• Budget: $${budget.spent.toFixed(2)} / $${budget.limit.toFixed(2)} (${budget.pct}%)`)
  lines.push('')

  if (topArticles.length > 0) {
    lines.push('<b>Top stories:</b>')
    for (const a of topArticles.slice(0, 4)) {
      const rel = Math.round((a.summary?.relevanceScore ?? 0) * 100)
      lines.push(`• <a href="${encodeURI(a.url)}">${escHtml(a.title)}</a> (${rel}%)`)
    }
  }

  const text = lines.filter(l => l !== undefined).join('\n').slice(0, 4096)

  // Save as notification (shows in web bell)
  if (userId) {
    await db.notification.create({
      data: {
        userId,
        type: 'SYSTEM',
        title: `Weekly Digest — ${weekLabel}`,
        body: aiNarrative || `${articlesThisWeek} articles, ${predictionsThisWeek} predictions this week.`,
        data: { type: 'weekly_digest', week: weekLabel },
      },
    }).catch(() => {})
  }

  await sendTelegram(text)
  console.log(`[weekly-digest] Sent for week ${weekLabel}`)
}

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('='))) as { force?: string; userId?: string }
  const force = args.force === '' || args.force === 'true'
  const db = getScoutDb()
  const models = await getModelsForCurrentBudget(getMonthlySpend)

  const pipelineUserId = args.userId ?? pipelineUserIdFromEnv()
  console.log(`[weekly-digest] Generating digest${pipelineUserId ? ` for ${pipelineUserId}` : ' (all users)'}`)

  const users = pipelineUserId
    ? [{ id: pipelineUserId }]
    : await db.user.findMany({ select: { id: true } })

  for (const user of users) {
    try {
      await generateWeeklyDigest(db, user.id, force, models.SUMMARIZER.id)
    } catch (err) {
      console.error(`[weekly-digest] Error for ${user.id}: ${(err as Error).message}`)
    }
  }

  await disconnectAll()
}

main().catch(err => { console.error('[weekly-digest] Fatal:', err); process.exit(1) })
