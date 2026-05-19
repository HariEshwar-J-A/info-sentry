#!/usr/bin/env tsx
/**
 * github-analyst.ts — Generate AI summaries for GitHub repos that have a README,
 *                     then post new repos to the Telegram GitHub-Feed topic.
 *
 * Usage:
 *   npx tsx scripts/github-analyst.ts                     # all repos without summary
 *   npx tsx scripts/github-analyst.ts --interestId=<id>  # one topic's repos
 *   npx tsx scripts/github-analyst.ts --limit=30          # max repos to process
 */
import "dotenv/config";
import { getScoutDb, disconnectAll } from "./lib/prisma.js";
import { chatCompletion } from "./lib/openrouter.js";
import { logCost, canSpend, getMonthlySpend } from "./lib/budget.js";
import { getModelsForCurrentBudget, TIER_3_BUDGET, type ModelConfig } from "./lib/models.js";
import { pipelineUserIdFromEnv } from "./lib/pipeline-scope.js";
import { notifyUser } from "./lib/push.js";

const BOT_TOKEN  = process.env["TELEGRAM_BOT_TOKEN"];
const SUPERGROUP = process.env["TELEGRAM_SUPERGROUP_ID"];

const SYSTEM_PROMPT = `You are a technical analyst evaluating GitHub repositories for software developers.

Write a detailed assessment of this repository in 5-8 sentences. Cover:
1. Exactly what the project does — be specific about the technology and mechanism, not vague
2. The core use cases and who would use it (e.g. "backend engineers building X", "ML engineers working on Y")
3. Key capabilities or features that distinguish it from alternatives
4. Technical approach, architecture, or design decisions worth knowing
5. Why a developer should pay attention to this — what makes it noteworthy right now
6. Any important requirements, caveats, or trade-offs to be aware of

Critical rules:
- Start DIRECTLY with the substance — absolutely do NOT write "This repository...", "Here is a summary...", "This tool...", or any meta-preamble
- The first word should be a noun or verb describing what the project does
- Write plain text only — no markdown, no bullet points, no headers
- Be concrete and specific; avoid vague adjectives like "powerful", "robust", or "comprehensive"
- Write as if briefing a senior engineer who has 60 seconds to decide if this is worth investigating`

// ─── Telegram helpers ───────────────────────────────────────

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

async function telegramApi(method: string, body: Record<string, unknown>): Promise<void> {
  if (!BOT_TOKEN || !SUPERGROUP) return
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = (await res.json()) as { ok: boolean; description?: string }
  if (!data.ok) console.warn(`[github-analyst] Telegram ${method} failed: ${data.description}`)
}

async function postRepoToTelegram(
  threadId: number | undefined,
  repo: {
    fullName: string; url: string; description: string | null; stars: number;
    starDelta: number; language: string | null; topics: string[]; aiSummary: string | null;
  },
): Promise<void> {
  if (!BOT_TOKEN || !SUPERGROUP) return

  const [owner, name] = repo.fullName.split("/")
  const trendBadge = repo.starDelta > 0 ? ` +${fmtNum(repo.starDelta)} ⭐` : ""
  const langPart   = repo.language ? ` · ${escHtml(repo.language)}` : ""

  const lines: string[] = [
    `⭐ <b><a href="${repo.url}">${escHtml(owner ?? "")}/${escHtml(name ?? "")}</a></b>${trendBadge}`,
    `<i>${fmtNum(repo.stars)} stars${langPart}</i>`,
  ]

  if (repo.description) lines.push("", escHtml(repo.description))
  if (repo.aiSummary)   lines.push("", `🤖 ${escHtml(repo.aiSummary)}`)

  const visibleTopics = repo.topics.slice(0, 5)
  if (visibleTopics.length > 0) {
    lines.push("", visibleTopics.map(t => `#${t.replace(/-/g, "_")}`).join(" "))
  }

  const text = lines.join("\n")
  const body: Record<string, unknown> = {
    chat_id: SUPERGROUP,
    text: text.slice(0, 4096),
    parse_mode: "HTML",
    disable_web_page_preview: true,
  }
  if (threadId !== undefined) body["message_thread_id"] = threadId

  await telegramApi("sendMessage", body)
}

// ─── LLM summarization with model fallback chain ────────────

async function summarizeWithFallback(
  context: string,
  candidates: ModelConfig[],
): Promise<{ response: Awaited<ReturnType<typeof chatCompletion>>; model: ModelConfig }> {
  let lastErr: Error | undefined
  for (const model of candidates) {
    try {
      const response = await chatCompletion(
        model.id,
        [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: context },
        ],
        { temperature: 0.3, maxTokens: 700, rateLimitFallbackModels: [] },
      )
      return { response, model }
    } catch (err) {
      lastErr = err as Error
      console.warn(`[github-analyst]   ↩ ${model.name} failed (${lastErr.message.split("\n")[0]}) — trying next`)
    }
  }
  throw lastErr ?? new Error("All models failed")
}

// ─── Main ───────────────────────────────────────────────────

async function main() {
  const args = Object.fromEntries(
    process.argv.slice(2).map(a => a.replace(/^--/, "").split("="))
  ) as { interestId?: string; limit?: string }

  const limit = parseInt(args.limit ?? "30", 10)
  const db = getScoutDb()

  const pipelineUserId = pipelineUserIdFromEnv()
  if (pipelineUserId && args.interestId) {
    const ok = await db.interest.findFirst({
      where: { id: args.interestId, userId: pipelineUserId, isActive: true },
    })
    if (!ok) {
      console.error("[github-analyst] Topic does not belong to this user or is inactive")
      await disconnectAll()
      process.exit(1)
    }
  }

  let scopedInterestIds: string[] | undefined
  if (pipelineUserId && !args.interestId) {
    scopedInterestIds = (
      await db.interest.findMany({
        where: { userId: pipelineUserId, isActive: true },
        select: { id: true },
      })
    ).map((r) => r.id)
    if (scopedInterestIds.length === 0) {
      console.log("[github-analyst] Web scope: no active topics — skipping")
      await disconnectAll()
      return
    }
    console.log(`[github-analyst] Web scope: ${scopedInterestIds.length} topic(s) for user`)
  }

  const repoInterestWhere =
    args.interestId ? { interestId: args.interestId }
    : scopedInterestIds ? { interestId: { in: scopedInterestIds } }
    : {}

  // Resolve GitHub-Feed Telegram thread
  let githubFeedThreadId: number | undefined
  if (BOT_TOKEN && SUPERGROUP) {
    const topic = await db.forumTopic.findUnique({ where: { name: "GitHub-Feed" } })
    githubFeedThreadId = topic?.telegramTopicId
    console.log(`[github-analyst] GitHub-Feed thread: ${githubFeedThreadId ?? "not found (run ensure-all)"}`)
  }

  if (!(await canSpend("github-analyst"))) {
    console.log("[github-analyst] Budget exceeded — skipping")
    await disconnectAll()
    return
  }

  const models = await getModelsForCurrentBudget(getMonthlySpend)
  // Use SUMMARIZER (Gemini Flash) — never a reasoning model like DeepSeek R1.
  // Reasoning models burn maxTokens on chain-of-thought before answering, producing finish_reason=length.
  const primaryModel = models.SUMMARIZER
  const fallbackModels: ModelConfig[] = [primaryModel, TIER_3_BUDGET].filter(
    (m, i, arr) => arr.findIndex(x => x.id === m.id) === i, // dedupe
  )
  console.log(`[github-analyst] Model chain: ${fallbackModels.map(m => m.name).join(" → ")}`)

  // ── Phase 0: clear summaries that contain known preamble patterns ──────────
  // Old prompt caused the model to emit "Here is a 2-3 sentence summary of..."
  const PREAMBLE_PATTERNS = ["Here is a", "Here's a", "This repository", "This tool", "This library", "This project"]
  const stale = await db.gitHubRepo.findMany({
    where: {
      aiSummary: { not: null },
      ...repoInterestWhere,
    },
    select: { id: true, fullName: true, aiSummary: true },
  })
  const toReset = stale.filter(r => PREAMBLE_PATTERNS.some(p => r.aiSummary!.startsWith(p)))
  if (toReset.length > 0) {
    console.log(`[github-analyst] Resetting ${toReset.length} stale summaries with preamble text`)
    await db.gitHubRepo.updateMany({
      where: { id: { in: toReset.map(r => r.id) } },
      data: { aiSummary: null },
    })
  }

  // ── Phase 1: generate summaries for repos that have a README but no summary ──
  const toSummarize = await db.gitHubRepo.findMany({
    where: {
      aiSummary: null,
      readme: { not: null },
      ...repoInterestWhere,
    },
    orderBy: { stars: "desc" },
    take: limit,
    select: { id: true, fullName: true, description: true, readme: true, stars: true, language: true, topics: true },
  })

  console.log(`[github-analyst] ${toSummarize.length} repos to summarize`)

  let processed = 0
  for (const repo of toSummarize) {
    try {
      const readmeSnippet = repo.readme?.slice(0, 4000) ?? ""
      const context = [
        `Repository: ${repo.fullName}`,
        repo.description ? `Description: ${repo.description}` : "",
        repo.language ? `Primary language: ${repo.language}` : "",
        repo.topics.length > 0 ? `Topics: ${repo.topics.join(", ")}` : "",
        `Stars: ${repo.stars.toLocaleString()}`,
        "",
        "README:",
        readmeSnippet,
      ].filter(Boolean).join("\n")

      const { response, model } = await summarizeWithFallback(context, fallbackModels)
      const aiSummary = response.content.trim()

      await db.gitHubRepo.update({
        where: { id: repo.id },
        data: { aiSummary },
      })

      await logCost("github-analyst", model, response.promptTokens, response.completionTokens, response.generationId)
      processed++
      console.log(`[github-analyst] ✓ ${repo.fullName} (${repo.stars.toLocaleString()} ⭐)`)
    } catch (err) {
      console.error(`[github-analyst] ✗ ${repo.fullName}: ${(err as Error).message}`)
    }
  }

  console.log(`[github-analyst] Done: ${processed}/${toSummarize.length} summaries generated`)

  // ── Phase 2: post unnotified repos to Telegram GitHub-Feed ──────────────────
  const toNotify = await db.gitHubRepo.findMany({
    where: {
      notifiedAt: null,
      ...repoInterestWhere,
    },
    orderBy: { stars: "desc" },
    take: 50,
    select: {
      id: true, fullName: true, url: true, description: true,
      stars: true, starDelta: true, language: true, topics: true, aiSummary: true,
    },
  })

  if (toNotify.length === 0) {
    console.log("[github-analyst] No new repos to notify")
  } else {
    console.log(`[github-analyst] Posting ${toNotify.length} new repo(s) to GitHub-Feed`)
    for (const repo of toNotify) {
      try {
        await postRepoToTelegram(githubFeedThreadId, repo)
        await db.gitHubRepo.update({ where: { id: repo.id }, data: { notifiedAt: new Date() } })
        console.log(`[github-analyst] 📨 Notified: ${repo.fullName}`)

        // Push notification to user
        if (pipelineUserId) {
          await notifyUser(
            db as Parameters<typeof notifyUser>[0],
            pipelineUserId,
            'NEW_GITHUB_REPO',
            {
              title: `New repo: ${repo.fullName}`,
              body: repo.description?.slice(0, 100) ?? `${repo.stars.toLocaleString()} stars · ${repo.language ?? 'unknown'}`,
              tag: `repo-${repo.id}`,
              data: { type: 'new_github', repoId: repo.id },
            },
            { repoId: repo.id },
          ).catch(() => {})
        }
      } catch (err) {
        console.error(`[github-analyst] ✗ notify ${repo.fullName}: ${(err as Error).message}`)
      }
    }
  }

  await disconnectAll()
}

main().catch(err => {
  console.error("[github-analyst] Fatal:", err)
  process.exit(1)
})
