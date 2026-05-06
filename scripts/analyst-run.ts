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

const exec = promisify(execFile);
const TSX = process.platform === "win32" ? "npx.cmd" : "npx";

const IGNORED_STDERR = [
  "The 'path' argument is deprecated",
  "Use --trace-deprecation",
];

async function runScript(script: string, args: string[]): Promise<string> {
  const { stdout, stderr } = await exec(TSX, ["tsx", script, ...args], {
    cwd: process.cwd(),
    env: process.env,
    timeout: 120_000,
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

async function postSummaryToTelegram(
  threadId: number | undefined,
  article: { title: string; url: string },
  summary: { summaryId: string; keyTopics: string[]; sentimentScore: number; relevanceScore: number },
  fullContent: string | null,
): Promise<void> {
  const sentiment = summary.sentimentScore > 0.3 ? "🟢" : summary.sentimentScore < -0.3 ? "🔴" : "🟡";
  const sections: string[] = [
    `${sentiment} <b>${escHtml(article.title)}</b>`,
    "",
  ];

  if (fullContent?.length) {
    sections.push("<b>📝 Summary:</b>");
    for (const para of fullContent.split("\n").filter((p) => p.trim()).slice(0, 5)) {
      sections.push(para.slice(0, 800));
    }
    sections.push("");
  }

  sections.push("<b>📊 Metadata:</b>");
  sections.push(`Topics: ${summary.keyTopics.join(", ")}`);
  sections.push(`Relevance: ${(summary.relevanceScore * 100).toFixed(0)}%`);
  sections.push(`<a href="${encodeURI(article.url)}">🔗 Source</a>`);

  const text = sections.join("\n");
  const chatId = threadId ? SUPERGROUP_ID : ADMIN_ID;
  const base: Record<string, unknown> = { chat_id: chatId, parse_mode: "HTML" };
  if (threadId) base["message_thread_id"] = threadId;

  const keyboard = {
    inline_keyboard: [[
      { text: "👍 Relevant", callback_data: `like_summary_${summary.summaryId}` },
      { text: "👎 Not for me", callback_data: `dislike_summary_${summary.summaryId}` },
    ]],
  };

  const MAX_LEN = 4096;
  if (text.length > MAX_LEN) {
    await telegramApi("sendMessage", { ...base, text: text.slice(0, MAX_LEN - 3) + "...", reply_markup: keyboard });
  } else {
    await telegramApi("sendMessage", { ...base, text, reply_markup: keyboard });
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const db = getOpenClawDb();
  const interestId = parseInterestIdArg();
  console.log("[analyst] Starting analyst run");

  let mainNewsThreadId: number | undefined;
  if (SUPERGROUP_ID) {
    const topic = await db.forumTopic.findUnique({ where: { name: "Main-News" } });
    mainNewsThreadId = topic?.telegramTopicId;
    console.log(`[analyst] Main-News topic: ${mainNewsThreadId ?? "DM fallback"}`);
  }

  const articles = await db.article.findMany({
    where: {
      status: "SCRAPED",
      ...(interestId
        ? { source: { interests: { some: { interestId } } } }
        : {}),
    },
    select: { id: true, url: true, title: true },
    orderBy: { scrapedAt: "asc" },
    take: 50,
  });

  console.log(`[analyst] ${articles.length} SCRAPED articles to analyze`);

  let processed = 0;
  for (const article of articles) {
    try {
      console.log(`[analyst] Analyzing: ${article.title}`);
      await db.article.update({ where: { id: article.id }, data: { status: "ANALYZING" } });

      const output = await runScript("scripts/analyst-process.ts", [`--articleId=${article.id}`]);
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

      await postSummaryToTelegram(mainNewsThreadId, article, result, summaryRecord?.content ?? null);
      await db.article.update({ where: { id: article.id }, data: { status: "SUMMARIZED", analyzedAt: new Date() } });
      processed++;
      console.log(`[analyst] Done: ${article.title}`);
    } catch (err) {
      console.error(`[analyst] Failed: ${article.title}`, err);
      await db.article.update({ where: { id: article.id }, data: { status: "FAILED" } }).catch(() => {});
    }
  }

  await db.agentConfig.upsert({
    where: { agentName: "analyst" },
    update: { lastRunAt: new Date(), lastError: null },
    create: { agentName: "analyst", lastRunAt: new Date() },
  }).catch(() => {});

  console.log(`[analyst] Complete: ${processed}/${articles.length} articles analyzed`);
  await disconnectAll();
}

main().catch((err) => {
  console.error("[analyst] Fatal:", err);
  process.exit(1);
});
