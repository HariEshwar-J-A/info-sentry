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
import { postToTopic, postRunLog, escHtml } from "./lib/telegram.js";

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Minimum confidence to include a prediction in the digest
const DIGEST_MIN_CONFIDENCE = 0.60;

interface AccumulatedPrediction {
  predictionId: string
  confidence:   number
  timeHorizon:  string
  content:      string
}

async function postPredictionDigest(
  predictions: AccumulatedPrediction[],
  connectionsToPast?: string,
): Promise<void> {
  const eligible = predictions.filter(p => p.confidence >= DIGEST_MIN_CONFIDENCE);
  if (eligible.length === 0) return;

  const lines = [`<b>🔮 ${eligible.length} New Prediction${eligible.length > 1 ? "s" : ""}</b>`, ""];

  for (const pred of eligible) {
    const pct = (pred.confidence * 100).toFixed(0);
    const emoji = pred.confidence > 0.75 ? "🎯" : "📊";
    lines.push(
      `${emoji} <b>${pct}%</b> — ${escHtml(pred.timeHorizon)}`,
      `   ${escHtml(pred.content.slice(0, 200))}`,
      "",
    );
  }

  if (connectionsToPast && connectionsToPast !== "No significant connections found.") {
    lines.push(`<b>🔗 Historical links:</b> ${escHtml(connectionsToPast.slice(0, 200))}`);
  }

  const firstId = eligible[0]?.predictionId ?? "";
  await postToTopic("Predictions", lines.join("\n"), firstId ? [[
    { text: "📌 Track this", callback_data: `track_prediction_${firstId}` },
    { text: "🗑️ Not useful", callback_data: `dismiss_prediction_${firstId}` },
  ]] : undefined);
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const startedAt = new Date();
  const db = getOpenClawDb();
  const interestId = parseInterestIdArg();
  const pipelineUserId = pipelineUserIdFromEnv();
  const articleScope = articleWhereScoped({ interestId, userId: pipelineUserId });

  console.log("[predictor] Starting predictor run");
  if (pipelineUserId) {
    console.log(`[predictor] Web scope: SUMMARIZED articles only for user ${pipelineUserId}`);
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

  // Accumulate all new predictions across articles; post ONE digest at the end
  const accumulated: AccumulatedPrediction[] = [];
  let lastConnections = "";
  let processed = 0;
  let skipped = 0;

  for (const article of articles) {
    try {
      const summary = await db.summary.findFirst({
        where: { articleId: article.id },
        select: { id: true },
        orderBy: { createdAt: "desc" },
      });

      if (!summary) {
        console.warn(`[predictor] No summary for: ${article.title} — skipping`);
        skipped++;
        continue;
      }

      // Check for existing predictions (accumulate without re-posting individually)
      const existingPreds = await db.prediction.findMany({
        where: { articleId: article.id },
        select: { id: true, confidence: true, timeHorizon: true, content: true },
      });

      if (existingPreds.length > 0) {
        console.log(`[predictor] Collecting existing predictions for: ${article.title}`);
        for (const p of existingPreds) {
          accumulated.push({ predictionId: p.id, confidence: p.confidence, timeHorizon: p.timeHorizon ?? "unknown", content: p.content });
        }
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
          if (result.connectionsToPast) lastConnections = result.connectionsToPast;
          for (const pred of result.predictions) {
            const full = await db.prediction.findUnique({ where: { id: pred.predictionId }, select: { content: true } });
            accumulated.push({ ...pred, content: full?.content ?? "" });
          }
        } else {
          skipped++;
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

  // Post ONE prediction digest for all accumulated predictions
  if (accumulated.length > 0) {
    try {
      await postPredictionDigest(accumulated, lastConnections || undefined);
      console.log(`[predictor] Posted prediction digest (${accumulated.length} predictions, ${accumulated.filter(p => p.confidence >= DIGEST_MIN_CONFIDENCE).length} above threshold)`);
    } catch (err) {
      console.warn(`[predictor] Prediction digest failed: ${(err as Error).message}`);
    }
  }

  await db.agentConfig.upsert({
    where: { agentName: "prediction" },
    update: { lastRunAt: new Date(), lastError: null },
    create: { agentName: "prediction", lastRunAt: new Date() },
  }).catch(() => {});

  const durationMs = Date.now() - startedAt.getTime();
  console.log(`[predictor] Complete: ${processed}/${articles.length} articles predicted`);

  await postRunLog({
    agent:     "prediction",
    startedAt,
    durationMs,
    succeeded: processed,
    skipped:   skipped > 0 ? skipped : undefined,
    failed:    0,
  }).catch(() => {});

  await disconnectAll();
}

main().catch((err) => {
  console.error("[predictor] Fatal:", err);
  process.exit(1);
});
