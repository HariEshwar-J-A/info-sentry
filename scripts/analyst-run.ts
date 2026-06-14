#!/usr/bin/env tsx
/**
 * analyst-run.ts — Analyst agent pipeline.
 *
 * Responsibility: SCRAPED → SUMMARIZED
 * - Fetches all SCRAPED articles
 * - Runs analyst-process.ts for each (LLM analysis + ChromaDB embedding)
 * - Posts summaries to Telegram Main-News topic
 * - Marks articles SUMMARIZED (or FAILED on error)
 *
 * Does NOT generate predictions — that is predictor-run.ts's job.
 */
import "dotenv/config";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getOpenClawDb, disconnectAll } from "./lib/prisma.js";
import { parseInterestIdArg } from "./lib/args.js";
import { articleWhereScoped, pipelineUserIdFromEnv } from "./lib/pipeline-scope.js";
import {
  assertOpenRouterKeyHasHeadroom,
  isOpenRouterKeyLimitExceeded,
  isOpenRouterKeyLimitExitCode,
  isOpenRouterRateLimitError,
  isOpenRouterRateLimitExitCode,
  OPENROUTER_KEY_SETTINGS_URL,
} from "./lib/openrouter.js";
import { postToTopic, postRunLog, escHtml } from "./lib/telegram.js";

const exec = promisify(execFile);
const TSX = process.platform === "win32" ? "npx.cmd" : "npx";

const ANALYST_PROCESS_TIMEOUT_MS = parseInt(process.env["ANALYST_PROCESS_TIMEOUT_MS"] ?? "420000", 10);

const IGNORED_STDERR = [
  "The 'path' argument is deprecated",
  "Use --trace-deprecation",
];

async function runScript(
  script: string,
  args: string[],
  timeoutMs: number = 120_000,
): Promise<string> {
  const { stdout, stderr } = await exec(TSX, ["tsx", script, ...args], {
    cwd: process.cwd(),
    env: process.env,
    timeout: timeoutMs,
  });
  const filtered = stderr
    .split("\n")
    .filter((l) => l.trim() && !IGNORED_STDERR.some((s) => l.includes(s)))
    .join("\n");
  if (filtered) console.error(filtered);
  const lines = stdout.trim().split("\n").filter((l) => l.trim());
  return lines[lines.length - 1] ?? "";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Minimum relevance to include an article in the news digest
const DIGEST_MIN_RELEVANCE = 0.60;

interface CompletedSummary {
  article: { title: string; url: string };
  summary: { summaryId: string; keyTopics: string[]; sentimentScore: number; relevanceScore: number };
  content: string | null;
}

async function postNewsDigest(items: CompletedSummary[]): Promise<void> {
  const relevant = items.filter(i => i.summary.relevanceScore >= DIGEST_MIN_RELEVANCE);
  if (relevant.length === 0) {
    console.log("[analyst] No articles above 60% relevance — skipping news digest");
    return;
  }

  const sorted = [...relevant].sort((a, b) => b.summary.relevanceScore - a.summary.relevanceScore);
  const dateStr = new Date().toLocaleString("en-CA", {
    timeZone: "America/Toronto",
    month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
    hour12: false,
  });

  const lines: string[] = [
    `<b>📰 News Digest</b> — ${escHtml(dateStr)} ET (${relevant.length}/${items.length} articles)`,
    "",
  ];

  for (const item of sorted.slice(0, 8)) {
    const rel = Math.round(item.summary.relevanceScore * 100);
    const relLabel = rel >= 80 ? "🔴 HIGH" : rel >= 60 ? "🟡 MED" : "🟢 LOW";
    const snippet = item.content?.split("\n").find(p => p.trim().length > 20)?.slice(0, 180) ?? "";
    lines.push(`${relLabel}: <b><a href="${encodeURI(item.article.url)}">${escHtml(item.article.title)}</a></b> (${rel}%)`);
    if (snippet) lines.push(`   ${escHtml(snippet)}${snippet.length >= 180 ? "…" : ""}`);
    if (item.summary.keyTopics.length > 0) {
      lines.push(`   <i>${escHtml(item.summary.keyTopics.slice(0, 3).join(", "))}</i>`);
    }
    lines.push("");
  }

  const firstId = sorted[0]?.summary.summaryId ?? "";
  await postToTopic("Main-News", lines.join("\n"), firstId ? [[
    { text: "👍 Relevant", callback_data: `like_summary_${firstId}` },
    { text: "👎 Not for me", callback_data: `dislike_summary_${firstId}` },
  ]] : undefined);
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const startedAt = new Date();
  const db = getOpenClawDb();
  const interestId = parseInterestIdArg();
  const pipelineUserId = pipelineUserIdFromEnv();
  const articleScope = articleWhereScoped({ interestId, userId: pipelineUserId });

  console.log("[analyst] Starting analyst run");
  if (pipelineUserId) {
    console.log(`[analyst] Web scope: articles only for user ${pipelineUserId}`);
  }

  try {
    await assertOpenRouterKeyHasHeadroom();
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes("reached key limit")) {
      console.error(`[analyst] ${msg}`);
      await disconnectAll();
      process.exit(1);
    }
    console.warn("[analyst] OpenRouter key preflight:", msg);
  }

  const articles = await db.article.findMany({
    where: {
      status: "SCRAPED",
      ...(articleScope ?? {}),
    },
    select: { id: true, url: true, title: true },
    orderBy: { scrapedAt: "asc" },
    take: 50,
  });

  console.log(`[analyst] ${articles.length} SCRAPED articles to analyze`);

  const completedSummaries: CompletedSummary[] = [];
  const errors: string[] = [];

  let processed = 0;
  let skipped = 0;
  let stoppedForKeyLimit = false;

  for (const article of articles) {
    try {
      console.log(`[analyst] Analyzing: ${article.title}`);
      await db.article.update({ where: { id: article.id }, data: { status: "ANALYZING" } });

      const output = await runScript(
        "scripts/analyst-process.ts",
        [`--articleId=${article.id}`],
        ANALYST_PROCESS_TIMEOUT_MS,
      );
      const result = JSON.parse(output) as {
        summaryId: string;
        keyTopics: string[];
        sentimentScore: number;
        relevanceScore: number;
      };

      const summaryRecord = await db.summary.findUnique({
        where: { id: result.summaryId },
        select: { content: true },
      });

      completedSummaries.push({ article, summary: result, content: summaryRecord?.content ?? null });

      if (result.relevanceScore < DIGEST_MIN_RELEVANCE) skipped++;

      await db.article.update({ where: { id: article.id }, data: { status: "SUMMARIZED", analyzedAt: new Date() } });
      processed++;
      console.log(`[analyst] Done: ${article.title}`);
    } catch (err) {
      const rateLimited =
        isOpenRouterRateLimitExitCode(err) ||
        isOpenRouterRateLimitError(err);
      if (rateLimited) {
        console.warn(
          "[analyst] Provider rate limited — waiting 25s before next article (current article left SCRAPED). Tip: https://openrouter.ai/settings/integrations",
        );
        await db.article.update({ where: { id: article.id }, data: { status: "SCRAPED" } }).catch(() => {});
        await sleep(25_000);
        continue;
      }
      const keyBlocked =
        isOpenRouterKeyLimitExitCode(err) || isOpenRouterKeyLimitExceeded(err);
      if (keyBlocked) {
        stoppedForKeyLimit = true;
        console.error(
          `[analyst] OpenRouter key spending limit exceeded — stopping batch. Configure at ${OPENROUTER_KEY_SETTINGS_URL}`,
        );
        await db.article.update({ where: { id: article.id }, data: { status: "SCRAPED" } }).catch(() => {});
        await db.agentConfig
          .upsert({
            where: { agentName: "analyst" },
            update: {
              lastRunAt: new Date(),
              lastError: "OpenRouter key limit exceeded — raise/remove cap at openrouter.ai/settings/keys",
            },
            create: {
              agentName: "analyst",
              lastRunAt: new Date(),
              lastError: "OpenRouter key limit exceeded — raise/remove cap at openrouter.ai/settings/keys",
            },
          })
          .catch(() => {});
        break;
      }
      console.error(`[analyst] Failed: ${article.title}`, err);
      errors.push(article.title.slice(0, 80));
      await db.article.update({ where: { id: article.id }, data: { status: "FAILED" } }).catch(() => {});
    }
  }

  // Always post a single digest (only if ≥1 article above relevance threshold)
  if (completedSummaries.length > 0) {
    try {
      await postNewsDigest(completedSummaries);
    } catch (err) {
      console.warn(`[analyst] News digest post failed: ${(err as Error).message}`);
    }
  }

  if (!stoppedForKeyLimit) {
    await db.agentConfig
      .upsert({
        where: { agentName: "analyst" },
        update: { lastRunAt: new Date(), lastError: null },
        create: { agentName: "analyst", lastRunAt: new Date() },
      })
      .catch(() => {});
  }

  const durationMs = Date.now() - startedAt.getTime();
  console.log(`[analyst] Complete: ${processed}/${articles.length} articles analyzed`);

  // Post structured run log to Telegram Run-Log topic
  await postRunLog({
    agent:      "analyst",
    startedAt,
    durationMs,
    succeeded:  processed,
    skipped:    skipped > 0 ? skipped : undefined,
    failed:     errors.length,
    errors:     errors.length > 0 ? errors : undefined,
  }).catch(() => {});

  await disconnectAll();
}

main().catch((err) => {
  console.error("[analyst] Fatal:", err);
  process.exit(1);
});
