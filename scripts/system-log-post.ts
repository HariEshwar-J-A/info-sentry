#!/usr/bin/env tsx
/**
 * system-log-post.ts — Post a health snapshot to the System-Log supergroup topic.
 * Runs every 30 minutes via cron.
 */
import "dotenv/config";
import { getOpenClawDb, disconnectAll } from "./lib/prisma.js";

const BOT_TOKEN = process.env["TELEGRAM_BOT_TOKEN"]!;
const SUPERGROUP_ID = process.env["TELEGRAM_SUPERGROUP_ID"]!;
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
  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const monthPct = Math.round((todaySpend / MONTHLY_BUDGET) * 100 * (daysInMonth / today.getDate()));
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
      const err = a.lastError ? ` ⚠️ ${a.lastError.slice(0, 50)}` : "";
      return `${icon} <code>${a.agentName.padEnd(10)}</code> ${ran}${err}`;
    })
    .join("\n");

  const pendingLine =
    pendingCount > 0
      ? `⏳ ${pendingCount} article${pendingCount > 1 ? "s" : ""} queued for processing`
      : "✅ No articles pending";

  const text =
    `<b>📡 System-Log · ${now} ET</b>\n\n` +
    `<b>Agents:</b>\n${agentLines}\n\n` +
    `<b>Stats:</b>\n` +
    `• Articles: ${articleCount} | Summaries: ${summaryCount} | Predictions: ${predCount}\n` +
    `• ${pendingLine}\n\n` +
    `<b>Budget:</b> $${todaySpend.toFixed(4)} today (~${monthPct}% monthly pace)`;

  const topic = await db.forumTopic.findUnique({ where: { name: "System-Log" } });
  if (!topic) throw new Error("System-Log topic not found in DB");

  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: SUPERGROUP_ID,
      text,
      parse_mode: "HTML",
      message_thread_id: topic.telegramTopicId,
    }),
  });

  const data = (await res.json()) as { ok: boolean; description?: string };
  if (!data.ok) throw new Error(`Telegram error: ${data.description}`);

  console.log(JSON.stringify({ posted: true, time: now }));
  await disconnectAll();
}

main()
  .catch((err) => {
    console.error("[system-log] Fatal:", err);
    process.exit(1);
  })
  .finally(() => disconnectAll());
