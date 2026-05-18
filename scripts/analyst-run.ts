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

// ─── Telegram ─────────────────────────────────────────────────────────────

const BOT_TOKEN = process.env["TELEGRAM_BOT_TOKEN"]!;
const SUPERGROUP_ID = process.env["TELEGRAM_SUPERGROUP_ID"];
const ADMIN_ID = process.env["TELEGRAM_ADMIN_ID"];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function telegramApi(method: string, body: Record<string, unknown>, retries = 3): Promise<unknown> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { ok: boolean; result?: unknown; description?: string; parameters?: { retry_after?: number } };
    if (data.ok) return data.result;
    const retryAfter = data.parameters?.retry_after;
    if (retryAfter && attempt < retries - 1) {
      console.warn(`[analyst] Telegram rate limit — waiting ${retryAfter}s`);
      await sleep(retryAfter * 1000 + 500);
      continue;
    }
    throw new Error(`Telegram ${method} failed: ${data.description ?? "unknown"}`);
  }
}

// Batch threshold: post individual messages when ≤ this many articles,
// otherwise post a single digest at the end.
const BATCH_THRESHOLD = parseInt(process.env["ANALYST_BATCH_THRESHOLD"] ?? "3", 10);

interface CompletedSummary {
  article: { title: string; url: string };
  summary: { summaryId: string; keyTopics: string[]; sentimentScore: number; relevanceScore: number };
  content: string | null;
}

async function postSingleSummary(
  threadId: number | undefined,
  { article, summary, content }: CompletedSummary,
): Promise<void> {
  const sentimentDot = summary.sentimentScore > 0.3 ? "+" : summary.sentimentScore < -0.3 ? "-" : "~";
  const sections: string[] = [
    `[${sentimentDot}] <b>${escHtml(article.title)}</b>`,
    "",
  ];

  if (content?.length) {
    for (const para of content.split("\n").filter((p) => p.trim()).slice(0, 4)) {
      sections.push(para.slice(0, 600));
    }
    sections.push("");
  }

  sections.push(`Topics: ${summary.keyTopics.join(", ")}`);
  sections.push(`Relevance: ${(summary.relevanceScore * 100).toFixed(0)}%`);
  sections.push(`<a href="${encodeURI(article.url)}">Source</a>`);

  const text = sections.join("\n");
  const chatId = threadId ? SUPERGROUP_ID : ADMIN_ID;
  const base: Record<string, unknown> = { chat_id: chatId, parse_mode: "HTML" };
  if (threadId) base["message_thread_id"] = threadId;

  const keyboard = {
    inline_keyboard: [[
      { text: "Relevant", callback_data: `like_summary_${summary.summaryId}` },
      { text: "Not for me", callback_data: `dislike_summary_${summary.summaryId}` },
    ]],
  };

  const MAX_LEN = 4096;
  const msg = text.length > MAX_LEN ? text.slice(0, MAX_LEN - 3) + "..." : text;
  await telegramApi("sendMessage", { ...base, text: msg, reply_markup: keyboard });
}

async function postBatchDigest(
  threadId: number | undefined,
  items: CompletedSummary[],
): Promise<void> {
  // Sort by relevance descending, take top items that fit in one message
  const sorted = [...items].sort((a, b) => b.summary.relevanceScore - a.summary.relevanceScore);

  const dateStr = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const lines: string[] = [
    `<b>News Digest</b> — ${escHtml(dateStr)} (${items.length} articles)`,
    "",
  ];

  for (const item of sorted.slice(0, 8)) {
    const rel = Math.round(item.summary.relevanceScore * 100);
    const snippet = item.content?.split("\n").find(p => p.trim().length > 20)?.slice(0, 200) ?? "";
    lines.push(`<b><a href="${encodeURI(item.article.url)}">${escHtml(item.article.title)}</a></b> (${rel}%)`);
    if (snippet) lines.push(escHtml(snippet) + (snippet.length >= 200 ? "…" : ""));
    if (item.summary.keyTopics.length > 0) lines.push(`<i>${escHtml(item.summary.keyTopics.slice(0, 3).join(", "))}</i>`);
    lines.push("");
  }

  const text = lines.join("\n").slice(0, 4096);
  const chatId = threadId ? SUPERGROUP_ID : ADMIN_ID;
  const base: Record<string, unknown> = { chat_id: chatId, parse_mode: "HTML", disable_web_page_preview: true };
  if (threadId) base["message_thread_id"] = threadId;
  await telegramApi("sendMessage", { ...base, text });
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
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

  let mainNewsThreadId: number | undefined;
  if (SUPERGROUP_ID) {
    const topic = await db.forumTopic.findUnique({ where: { name: "Main-News" } });
    mainNewsThreadId = topic?.telegramTopicId;
    console.log(`[analyst] Main-News topic: ${mainNewsThreadId ?? "DM fallback"}`);
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

  const useBatch = articles.length > BATCH_THRESHOLD;
  const completedSummaries: CompletedSummary[] = [];

  let processed = 0;
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

      const completed: CompletedSummary = { article, summary: result, content: summaryRecord?.content ?? null };

      if (useBatch) {
        // Collect for end-of-run digest
        completedSummaries.push(completed);
      } else {
        // Post immediately for small batches
        await postSingleSummary(mainNewsThreadId, completed);
      }

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
      await db.article.update({ where: { id: article.id }, data: { status: "FAILED" } }).catch(() => {});
    }
  }

  // Post batch digest if we collected summaries
  if (completedSummaries.length > 0) {
    try {
      await postBatchDigest(mainNewsThreadId, completedSummaries);
      console.log(`[analyst] Posted batch digest for ${completedSummaries.length} articles`);
    } catch (err) {
      console.warn(`[analyst] Batch digest failed: ${(err as Error).message}`);
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

  console.log(`[analyst] Complete: ${processed}/${articles.length} articles analyzed`);
  await disconnectAll();
}

main().catch((err) => {
  console.error("[analyst] Fatal:", err);
  process.exit(1);
});
