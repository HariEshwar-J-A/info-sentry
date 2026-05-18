#!/usr/bin/env tsx
/**
 * predictor-run.ts — Predictor agent pipeline.
 *
 * Responsibility: SUMMARIZED → POSTED
 * - Fetches all SUMMARIZED articles (already analyzed, not yet predicted)
 * - Runs prediction-process.ts for each
 * - Posts predictions to Telegram Predictions topic
 * - Marks articles POSTED (or FAILED on error)
 *
 * Does NOT analyze articles — that is analyst-run.ts's job.
 */
import "dotenv/config";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getOpenClawDb, disconnectAll } from "./lib/prisma.js";
import { parseInterestIdArg } from "./lib/args.js";
import { articleWhereScoped, pipelineUserIdFromEnv } from "./lib/pipeline-scope.js";

const exec = promisify(execFile);
const TSX = process.platform === "win32" ? "npx.cmd" : "npx";

/** Kimi → DeepSeek fallback + OpenRouter 429 retries can exceed 2m; align with analyst child budget. */
const PREDICTION_PROCESS_TIMEOUT_MS = parseInt(process.env["PREDICTION_PROCESS_TIMEOUT_MS"] ?? "420000", 10);

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
      console.warn(`[predictor] Telegram rate limit — waiting ${retryAfter}s`);
      await sleep(retryAfter * 1000 + 500);
      continue;
    }
    throw new Error(`Telegram ${method} failed: ${data.description ?? "unknown"}`);
  }
}

async function postPredictionsToTelegram(
  threadId: number | undefined,
  predictions: { predictionId: string; confidence: number; timeHorizon: string }[],
  connectionsToPast: string,
): Promise<void> {
  if (predictions.length === 0) return;

  const db = getOpenClawDb();
  const lines = ["<b>🔮 Predictions</b>", ""];

  for (const pred of predictions) {
    const full = await db.prediction.findUnique({
      where: { id: pred.predictionId },
      select: { content: true },
    });
    const confidence = (pred.confidence * 100).toFixed(0);
    const emoji = pred.confidence > 0.7 ? "🎯" : pred.confidence > 0.5 ? "📊" : "💭";
    lines.push(
      `${emoji} <b>${confidence}% confidence — ${pred.timeHorizon}</b>`,
      `   ${full?.content ?? ""}`,
      "",
    );
  }

  if (connectionsToPast && connectionsToPast !== "No significant connections found.") {
    lines.push(`<b>🔗 Historical links:</b> ${connectionsToPast}`);
  }

  const text = lines.join("\n");
  const truncated = text.length > 4000 ? text.slice(0, 3997) + "..." : text;
  const firstId = predictions[0]?.predictionId ?? "";
  const chatId = threadId ? SUPERGROUP_ID : ADMIN_ID;
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text: truncated,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [[
        { text: "📌 Track this", callback_data: `track_prediction_${firstId}` },
        { text: "🗑️ Not useful", callback_data: `dismiss_prediction_${firstId}` },
      ]],
    },
  };
  if (threadId) body["message_thread_id"] = threadId;

  await telegramApi("sendMessage", body);
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const db = getOpenClawDb();
  const interestId = parseInterestIdArg();
  const pipelineUserId = pipelineUserIdFromEnv();
  const articleScope = articleWhereScoped({ interestId, userId: pipelineUserId });

  console.log("[predictor] Starting predictor run");
  if (pipelineUserId) {
    console.log(`[predictor] Web scope: SUMMARIZED articles only for user ${pipelineUserId}`);
  }

  let predictionsThreadId: number | undefined;
  if (SUPERGROUP_ID) {
    const topic = await db.forumTopic.findUnique({ where: { name: "Predictions" } });
    predictionsThreadId = topic?.telegramTopicId;
    console.log(`[predictor] Predictions topic: ${predictionsThreadId ?? "DM fallback"}`);
  }

  const articles = await db.article.findMany({
    where: {
      status: "SUMMARIZED",
      ...(articleScope ?? {}),
    },
    select: { id: true, title: true },
    orderBy: { analyzedAt: "asc" },
    take: 50,
  });

  console.log(`[predictor] ${articles.length} SUMMARIZED articles to predict`);

  let processed = 0;
  for (const article of articles) {
    try {
      const summary = await db.summary.findFirst({
        where: { articleId: article.id },
        select: { id: true },
        orderBy: { createdAt: "desc" },
      });

      if (!summary) {
        console.warn(`[predictor] No summary for: ${article.title} — skipping`);
        continue;
      }

      // Check for existing predictions (re-post if already generated)
      const existingPreds = await db.prediction.findMany({
        where: { articleId: article.id },
        select: { id: true, confidence: true, timeHorizon: true },
      });

      if (existingPreds.length > 0) {
        console.log(`[predictor] Reposting existing predictions for: ${article.title}`);
        await postPredictionsToTelegram(
          predictionsThreadId,
          existingPreds.map((p) => ({ predictionId: p.id, confidence: p.confidence, timeHorizon: p.timeHorizon ?? "unknown" })),
          "",
        );
      } else {
        console.log(`[predictor] Predicting: ${article.title}`);
        const output = await runScript(
          "scripts/prediction-process.ts",
          [`--summaryId=${summary.id}`],
          PREDICTION_PROCESS_TIMEOUT_MS,
        );
        const result = JSON.parse(output) as {
          predictions: { predictionId: string; confidence: number; timeHorizon: string }[];
          connectionsToPast?: string;
          skipped: boolean;
        };

        if (!result.skipped) {
          await postPredictionsToTelegram(predictionsThreadId, result.predictions, result.connectionsToPast ?? "");
        }
      }

      await db.article.update({ where: { id: article.id }, data: { status: "POSTED" } });
      processed++;
      console.log(`[predictor] Done: ${article.title}`);
    } catch (err) {
      console.error(`[predictor] Failed: ${article.title}`, err);
      await db.article.update({ where: { id: article.id }, data: { status: "FAILED" } }).catch(() => {});
    }
  }

  await db.agentConfig.upsert({
    where: { agentName: "prediction" },
    update: { lastRunAt: new Date(), lastError: null },
    create: { agentName: "prediction", lastRunAt: new Date() },
  }).catch(() => {});

  console.log(`[predictor] Complete: ${processed}/${articles.length} articles predicted`);
  await disconnectAll();
}

main().catch((err) => {
  console.error("[predictor] Fatal:", err);
  process.exit(1);
});
