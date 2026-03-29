#!/usr/bin/env tsx
/**
 * pipeline-run.ts — Orchestrate the full article pipeline.
 *
 * Triggered by OpenClaw cron every 2h at :15.
 * 1. Queries SCRAPED articles
 * 2. Analyzes each → writes summaries
 * 3. Generates predictions for each summary
 * 4. Posts summaries + predictions to Telegram
 * 5. Marks articles as POSTED
 */
import "dotenv/config";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getOpenClawDb, disconnectAll } from "./lib/prisma.js";

const exec = promisify(execFile);
const TSX = process.platform === "win32" ? "npx.cmd" : "npx";

async function runScript(script: string, args: string[]): Promise<string> {
  const { stdout, stderr } = await exec(TSX, ["tsx", script, ...args], {
    cwd: process.cwd(),
    env: process.env,
    timeout: 120_000,
  });
  if (stderr) console.error(stderr.trim());
  return stdout.trim();
}

async function postSummaryToTelegram(
  articleTitle: string,
  articleUrl: string,
  summary: { summaryId: string; keyTopics: string[]; sentimentScore: number; relevanceScore: number },
): Promise<void> {
  const sentiment = summary.sentimentScore > 0.3 ? "🟢" : summary.sentimentScore < -0.3 ? "🔴" : "🟡";
  const text = [
    `${sentiment} <b>${articleTitle}</b>`,
    "",
    `<b>Topics:</b> ${summary.keyTopics.join(", ")}`,
    `<b>Relevance:</b> ${(summary.relevanceScore * 100).toFixed(0)}%`,
    `<a href="${articleUrl}">Source</a>`,
  ].join("\n");

  await runScript("scripts/telegram-send.ts", [
    `--topic=Main-News`,
    `--text=${text}`,
    `--keyboard=summary`,
    `--id=${summary.summaryId}`,
  ]);
}

async function postPredictionsToTelegram(
  predictions: { predictionId: string; confidence: number; timeHorizon: string }[],
  connectionsToPast: string,
): Promise<void> {
  if (predictions.length === 0) return;

  // We need the full prediction content — fetch from DB
  const db = getOpenClawDb();
  const lines = [`<b>Predictions</b>`, ""];

  for (const pred of predictions) {
    const full = await db.prediction.findUnique({
      where: { id: pred.predictionId },
      select: { content: true },
    });
    const confidence = (pred.confidence * 100).toFixed(0);
    lines.push(
      `• <b>[${confidence}% confidence, ${pred.timeHorizon}]</b>`,
      `  ${full?.content ?? ""}`,
      "",
    );
  }

  if (connectionsToPast && connectionsToPast !== "No significant connections found.") {
    lines.push(`<b>Historical links:</b> ${connectionsToPast}`);
  }

  const firstId = predictions[0]?.predictionId ?? "";
  await runScript("scripts/telegram-send.ts", [
    `--topic=Predictions`,
    `--text=${lines.join("\n")}`,
    `--keyboard=prediction`,
    `--id=${firstId}`,
  ]);
}

async function main(): Promise<void> {
  const db = getOpenClawDb();
  console.log("[pipeline] Starting pipeline run");

  // 1. Get SCRAPED articles
  const articles = await db.article.findMany({
    where: { status: "SCRAPED" },
    select: { id: true, url: true, title: true, sourceId: true },
    orderBy: { scrapedAt: "asc" },
    take: 50,
  });

  console.log(`[pipeline] ${articles.length} articles to process`);

  for (const article of articles) {
    try {
      // 2. Analyze
      console.log(`[pipeline] Analyzing: ${article.title}`);
      const analystOutput = await runScript("scripts/analyst-process.ts", [`--articleId=${article.id}`]);
      const analystResult = JSON.parse(analystOutput) as {
        summaryId: string;
        chromaId: string;
        keyTopics: string[];
        sentimentScore: number;
        relevanceScore: number;
      };

      // 3. Post summary to Telegram
      await postSummaryToTelegram(article.title, article.url, analystResult);

      // 4. Generate predictions
      console.log(`[pipeline] Predicting: ${article.title}`);
      const predOutput = await runScript("scripts/prediction-process.ts", [`--summaryId=${analystResult.summaryId}`]);
      const predResult = JSON.parse(predOutput) as {
        predictions: { predictionId: string; confidence: number; timeHorizon: string }[];
        connectionsToPast?: string;
        skipped: boolean;
      };

      // 5. Post predictions to Telegram
      if (!predResult.skipped) {
        await postPredictionsToTelegram(predResult.predictions, predResult.connectionsToPast ?? "");
      }

      // 6. Mark as POSTED
      await db.article.update({ where: { id: article.id }, data: { status: "POSTED" } });
      console.log(`[pipeline] Done: ${article.title}`);
    } catch (err) {
      console.error(`[pipeline] Failed: ${article.title}`, err);
      await db.article.update({ where: { id: article.id }, data: { status: "FAILED" } }).catch(() => {});
    }
  }

  // Record run
  await db.agentConfig.update({
    where: { agentName: "analyst" },
    data: { lastRunAt: new Date(), lastError: null },
  }).catch(() => {});
  await db.agentConfig.update({
    where: { agentName: "prediction" },
    data: { lastRunAt: new Date(), lastError: null },
  }).catch(() => {});

  console.log("[pipeline] Pipeline run complete");
  await disconnectAll();
}

main().catch((err) => {
  console.error("[pipeline] Fatal:", err);
  process.exit(1);
});
