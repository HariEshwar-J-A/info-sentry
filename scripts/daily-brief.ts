#!/usr/bin/env tsx
/**
 * daily-brief.ts — Personalized daily content brief.
 *
 * Generates an AI-written 5-sentence summary of the day's most relevant
 * articles, weighted by interest scores. Posts to Telegram DM and saves
 * as a Notification so it surfaces in the web feed header.
 *
 * Usage:
 *   npx tsx scripts/daily-brief.ts                    # run for all users
 *   npx tsx scripts/daily-brief.ts --userId=<id>      # single user
 *   npx tsx scripts/daily-brief.ts --force            # skip dedup check
 *
 * Recommended cron: 0 8 * * * (daily at 8am)
 */
import 'dotenv/config'
import { getScoutDb, disconnectAll } from './lib/prisma.js'
import { chatCompletion } from './lib/openrouter.js'
import { canSpend, getMonthlySpend } from './lib/budget.js'
import { getModelsForCurrentBudget } from './lib/models.js'

const BOT_TOKEN = process.env['TELEGRAM_BOT_TOKEN']
const ADMIN_ID  = process.env['TELEGRAM_ADMIN_ID']

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

async function sendTelegram(text: string): Promise<void> {
  if (!BOT_TOKEN || !ADMIN_ID) return
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: ADMIN_ID, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  })
  const data = (await res.json()) as { ok: boolean; description?: string }
  if (!data.ok) console.warn(`[daily-brief] Telegram failed: ${data.description}`)
}

async function generateBriefForUser(
  db: ReturnType<typeof getScoutDb>,
  userId: string,
  force: boolean,
  modelId: string,
): Promise<void> {
  // Dedup: skip if we sent a brief today
  if (!force) {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const existing = await db.notification.findFirst({
      where: { userId, type: 'SYSTEM', title: { startsWith: 'Daily Brief' }, createdAt: { gte: todayStart } },
    })
    if (existing) {
      console.log(`[daily-brief] Already sent today for ${userId} — skipping (use --force to override)`)
      return
    }
  }

  // Fetch user interests with scores
  const interests = await db.interest.findMany({
    where: { userId, isActive: true },
    select: { topic: true, score: true },
    orderBy: { score: 'desc' },
  })

  if (interests.length === 0) {
    console.log(`[daily-brief] No active interests for ${userId} — skipping`)
    return
  }

  // Build topic→score map
  const topicScores = new Map(interests.map(i => [i.topic.toLowerCase(), i.score]))

  // Fetch recent articles (last 36h to cover overnight content)
  const since = new Date(Date.now() - 36 * 60 * 60 * 1000)
  const articles = await db.article.findMany({
    where: {
      scrapedAt: { gte: since },
      status: { in: ['SUMMARIZED', 'POSTED'] },
      summary: { isNot: null },
    },
    include: {
      summary: { select: { content: true, keyTopics: true, relevanceScore: true } },
    },
    orderBy: { scrapedAt: 'desc' },
    take: 200,
  })

  if (articles.length === 0) {
    console.log(`[daily-brief] No recent articles for ${userId} — skipping`)
    return
  }

  // Score each article: relevanceScore × max(interestScore for any matching topic)
  type ScoredArticle = typeof articles[0] & { briefScore: number }
  const scored: ScoredArticle[] = articles
    .filter(a => a.summary)
    .map(a => {
      const relevance = a.summary?.relevanceScore ?? 0
      const maxInterest = (a.summary?.keyTopics ?? []).reduce((max, t) => {
        return Math.max(max, topicScores.get(t.toLowerCase()) ?? 0)
      }, 0)
      return { ...a, briefScore: relevance * (maxInterest > 0 ? maxInterest : 0.2) }
    })
    .filter(a => a.briefScore > 0)
    .sort((a, b) => b.briefScore - a.briefScore)
    .slice(0, 8)

  if (scored.length === 0) {
    console.log(`[daily-brief] No relevant articles found for ${userId}`)
    return
  }

  // Build LLM context
  const date = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const topTopics = interests.slice(0, 5).map(i => i.topic).join(', ')
  const articleList = scored.map((a, i) =>
    `[${i + 1}] ${a.title}\n${a.summary?.content?.slice(0, 400) ?? ''}`
  ).join('\n\n')

  const systemPrompt = `You are writing a brief daily intelligence report for a professional reader.
Write 4-6 sentences that cover the most important developments from today's articles.
Focus on what's actionable, surprising, or consequential.
Start directly with the content — no greetings, no "here is your brief".
Plain text only. No bullet points. No markdown.`

  const userPrompt = `Today is ${date}. The reader tracks: ${topTopics}.

Top articles from the last 24 hours:

${articleList}

Write a concise personalized brief covering the most significant developments.`

  console.log(`[daily-brief] Generating brief for ${userId} (${scored.length} articles)…`)

  const response = await chatCompletion(
    modelId,
    [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
    { temperature: 0.4, maxTokens: 400, rateLimitFallbackModels: [] },
  )

  const brief = response.content.trim()
  console.log(`[daily-brief] Brief: ${brief.slice(0, 120)}…`)

  // Save as Notification (shows in web bell dropdown)
  await db.notification.create({
    data: {
      userId,
      type: 'SYSTEM',
      title: `Daily Brief — ${date}`,
      body: brief,
      data: { type: 'daily_brief', date },
    },
  })

  // Post to Telegram DM
  const topicLine = `<i>Tracking: ${escHtml(topTopics)}</i>`
  const message = [
    `<b>Daily Brief</b> — ${escHtml(date)}`,
    topicLine,
    '',
    escHtml(brief),
  ].join('\n')

  await sendTelegram(message)
  console.log(`[daily-brief] Sent for user ${userId}`)
}

async function main() {
  const args = Object.fromEntries(
    process.argv.slice(2).map(a => a.replace(/^--/, '').split('='))
  ) as { userId?: string; force?: string }

  const force = args.force === '' || args.force === 'true'
  const db = getScoutDb()

  if (!(await canSpend('daily-brief'))) {
    console.log('[daily-brief] Budget exceeded — skipping')
    await disconnectAll()
    return
  }

  const models = await getModelsForCurrentBudget(getMonthlySpend)
  const modelId = models.SUMMARIZER.id
  console.log(`[daily-brief] Model: ${models.SUMMARIZER.name}`)

  const users = args.userId
    ? [{ id: args.userId }]
    : await db.user.findMany({ select: { id: true } })

  console.log(`[daily-brief] ${users.length} user(s) to process`)

  for (const user of users) {
    try {
      await generateBriefForUser(db, user.id, force, modelId)
    } catch (err) {
      console.error(`[daily-brief] Error for ${user.id}: ${(err as Error).message}`)
    }
  }

  await disconnectAll()
}

main().catch(err => {
  console.error('[daily-brief] Fatal:', err)
  process.exit(1)
})
