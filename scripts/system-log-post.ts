#!/usr/bin/env tsx
/**
 * system-log-post.ts — Post a system health snapshot to the Alerts topic.
 *
 * This is no longer run on a cron schedule. Call it explicitly when needed:
 *   npx tsx scripts/system-log-post.ts
 *
 * Triggered events (handled by cron-runner.ts via logAlert):
 *   - Agent crash (non-zero exit)
 *   - Budget > 80% of monthly cap
 */
import "dotenv/config";
import { getOpenClawDb, disconnectAll } from "./lib/prisma.js";
import { postToTopic, escHtml } from "./lib/telegram.js";

const MONTHLY_BUDGET = parseFloat(process.env["MONTHLY_BUDGET_USD"] ?? "7.30");

function timeAgo(date: Date | null): string {
  if (!date) return "never";
  const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

async function main(): Promise<void> {
  const db = getOpenClawDb();

  const [agents, articleCount, summaryCount, predCount, pendingCount, costLogs] = await Promise.all([
    db.agentConfig.findMany({
      select: { agentName: true, isActive: true, lastRunAt: true, lastError: true },
      orderBy: { agentName: "asc" },
    }),
    db.article.count(),
    db.summary.count(),
    db.prediction.count(),
    db.article.count({ where: { status: "SCRAPED" } }),
    db.costLog.findMany({
      where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      select: { totalCostUsd: true },
    }),
  ]);

  const todaySpend = costLogs.reduce((s, c) => s + c.totalCostUsd, 0);
  const budgetPct  = ((todaySpend / MONTHLY_BUDGET) * 100).toFixed(1);
  const now = new Date().toLocaleTimeString("en-CA", {
    timeZone: "America/Toronto",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const agentLines = agents
    .map((a) => {
      const icon = a.lastError ? "❌" : a.isActive ? "✅" : "⏸️";
      const ran = timeAgo(a.lastRunAt);
      const err = a.lastError ? ` ⚠️ ${escHtml(a.lastError.slice(0, 50))}` : "";
      return `${icon} <code>${a.agentName.padEnd(10)}</code> ${ran}${err}`;
    })
    .join("\n");

  const pendingLine =
    pendingCount > 0
      ? `⏳ ${pendingCount} article${pendingCount > 1 ? "s" : ""} queued`
      : "✅ No articles pending";

  const text =
    `<b>📡 System Snapshot · ${now} ET</b>\n\n` +
    `<b>Agents:</b>\n${agentLines}\n\n` +
    `<b>Stats:</b>\n` +
    `• Articles: ${articleCount} | Summaries: ${summaryCount} | Predictions: ${predCount}\n` +
    `• ${pendingLine}\n\n` +
    `<b>Budget (24h):</b> $${todaySpend.toFixed(4)} / $${MONTHLY_BUDGET.toFixed(2)} (${budgetPct}% daily pace)`;

  await postToTopic("Alerts", text);
  console.log(JSON.stringify({ posted: true, time: now }));
  await disconnectAll();
}

main()
  .catch((err) => {
    console.error("[system-log] Fatal:", err);
    process.exit(1);
  })
  .finally(() => disconnectAll());
