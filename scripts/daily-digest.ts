#!/usr/bin/env tsx
/**
 * daily-digest.ts — Daily summary for Telegram
 *
 * Generates once-daily summary of:
 * - Articles processed
 * - Predictions made (pending validation)
 * - Budget status
 * - Items awaiting approval
 *
 * Usage: npx tsx scripts/daily-digest.ts [--force]
 */
import "dotenv/config";
import { getOpenClawDb, disconnectAll } from "./lib/prisma.js";
import { getBudgetStatus } from "./lib/budget.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);
const TSX = process.platform === "win32" ? "npx.cmd" : "npx";

async function sendTelegram(text: string, keyboard?: unknown[]): Promise<void> {
  const BOT_TOKEN = process.env["TELEGRAM_BOT_TOKEN"]!;
  const ADMIN_ID = process.env["TELEGRAM_ADMIN_ID"]!;

  const body: Record<string, unknown> = {
    chat_id: ADMIN_ID,
    text,
    parse_mode: "HTML",
  };

  if (keyboard && keyboard.length > 0) {
    body.reply_markup = { inline_keyboard: keyboard };
  }

  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as { ok: boolean; description?: string };
  if (!data.ok) {
    throw new Error(`Telegram API failed: ${data.description ?? "unknown"}`);
  }
}

function formatCurrency(usd: number): string {
  const cad = usd * 1.37; // Approximate USD to CAD
  return `$${cad.toFixed(2)} CAD ($${usd.toFixed(2)} USD)`;
}

async function main(): Promise<void> {
  const db = getOpenClawDb();
  const force = process.argv.includes("--force");

  // Check if already sent today (unless force)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayStart = new Date(today);
  const todayEnd = new Date(today);
  todayEnd.setHours(23, 59, 59, 999);

  // Get today's digest status - we can track this via a special chat message or just run
  // For simplicity, we'll run unless --check-sent flag is used in future

  // Gather stats
  const [articlesToday, summariesToday, predictionsToday, pendingValidations, budget] =
    await Promise.all([
      db.article.count({
        where: { scrapedAt: { gte: todayStart, lte: todayEnd } },
      }),
      db.summary.count({
        where: { createdAt: { gte: todayStart, lte: todayEnd } },
      }),
      db.prediction.count({
        where: { createdAt: { gte: todayStart, lte: todayEnd } },
      }),
      db.validationQueue.count({ where: { status: "PENDING" } }),
      getBudgetStatus(),
    ]);

  // Total all-time stats
  const [totalArticles, totalPredictions, resolvedPredictions] = await Promise.all([
    db.article.count(),
    db.prediction.count(),
    db.prediction.count({
      where: { status: { in: ["CORRECT", "INCORRECT", "PARTIALLY_CORRECT"] } },
    }),
  ]);

  // Budget status with tier indicator
  const tierEmoji = budget.percentUsed > 0.9 ? "🔴" : budget.percentUsed > 0.7 ? "🟡" : "🟢";
  const budgetLine = `${tierEmoji} Budget: ${formatCurrency(budget.monthlySpendUsd)} / ${formatCurrency(budget.budgetLimitUsd)} (${(budget.percentUsed * 100).toFixed(0)}%)`;

  // Build digest message
  const lines: string[] = [
    "📊 <b>Info-Sentry Daily Digest</b>",
    `📅 ${today.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}`,
    "",
    "<b>Today:</b>",
    `• ${articlesToday} articles scraped`,
    `• ${summariesToday} analyzed`,
    `• ${predictionsToday} predictions generated`,
    pendingValidations > 0 ? `• ⏳ ${pendingValidations} awaiting your validation` : "",
    "",
    "<b>All Time:</b>",
    `• ${totalArticles} articles processed`,
    `• ${totalPredictions} predictions made`,
    resolvedPredictions > 0 ? `• ${resolvedPredictions} predictions resolved` : "",
    "",
    budgetLine,
  ];

  // Add warnings if applicable
  if (budget.percentUsed > 0.9) {
    lines.push("⚠️ <b>CRITICAL:</b> Budget nearly exhausted! Switched to free models.");
  } else if (budget.percentUsed > 0.7) {
    lines.push("⚡ Budget >70% - using economy models to extend runway.");
  }

  // Build keyboard
  const keyboard: unknown[] = [];
  if (pendingValidations > 0) {
    keyboard.push([
      { text: `⏳ Review ${pendingValidations} Predictions`, callback_data: "review_pending" },
    ]);
  }
  keyboard.push([
    { text: "📈 View Stats", callback_data: "view_stats" },
    { text: "💰 Budget Details", callback_data: "view_budget" },
  ]);

  const message = lines.filter(Boolean).join("\n");
  await sendTelegram(message, keyboard);

  console.log("[daily-digest] Sent successfully");
  await disconnectAll();
}

main().catch((err) => {
  console.error("[daily-digest] Fatal:", err);
  process.exit(1);
});
