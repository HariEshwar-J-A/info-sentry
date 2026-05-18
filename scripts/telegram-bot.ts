#!/usr/bin/env tsx
/**
 * telegram-bot.ts — Info-Sentry Telegram bot.
 *
 * Handles:
 *   - Admin DM commands (/status, /budget, /run, /pending, /digest, /help)
 *   - Inline button callbacks from DM and supergroup (like/dislike/mute/track/dismiss)
 *
 * Run: npx tsx scripts/telegram-bot.ts
 */
import "dotenv/config";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getOpenClawDb } from "./lib/prisma.js";

const exec = promisify(execFile);

const BOT_TOKEN = process.env["TELEGRAM_BOT_TOKEN"]!;
const ADMIN_ID = process.env["TELEGRAM_ADMIN_ID"]!;
const SUPERGROUP_ID = process.env["TELEGRAM_SUPERGROUP_ID"] ?? "";
const MONTHLY_BUDGET = parseFloat(process.env["MONTHLY_BUDGET_USD"] ?? "7.30");
/** Scout v3 + ScrapeGraph needs more than legacy 2-minute caps */
const SCOUT_SCRIPT_TIMEOUT_MS = parseInt(process.env["SCOUT_SCRIPT_TIMEOUT_MS"] ?? "900000", 10);

// ─── Types ───────────────────────────────────────────────────────────────────

const FEEDBACK_THREAD_ID = 7;
const USER_ID = "cmoi886x30000z57fqxkeg2ms"; // Harieshwar

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: { id: number; username?: string };
    chat: { id: number; type: string };
    text?: string;
    message_thread_id?: number;
  };
  callback_query?: {
    id: string;
    from: { id: number; username?: string };
    message?: { message_id: number; chat: { id: number } };
    data?: string;
  };
}

// ─── API helpers ─────────────────────────────────────────────────────────────

async function telegramPost(method: string, body: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { ok: boolean; result?: unknown; description?: string };
  if (!data.ok) throw new Error(`Telegram ${method}: ${data.description ?? "unknown"}`);
  return data.result;
}

async function send(chatId: number | string, text: string, extra: Record<string, unknown> = {}): Promise<void> {
  await telegramPost("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", ...extra }).catch(
    (err) => console.error("[bot] send error:", (err as Error).message),
  );
}

async function answerCb(callbackId: string, text: string, alert = false): Promise<void> {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackId, text, show_alert: alert }),
  }).catch(() => {});
}

async function runScript(script: string, args: string[]): Promise<string> {
  const { stdout } = await exec("npx", ["tsx", script, ...args], {
    cwd: process.cwd(),
    env: process.env,
    timeout: 90_000,
  });
  const text = stdout.trim();
  // Extract the JSON object — scripts may print log lines before or output pretty JSON
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) return text.slice(start, end + 1);
  // Fallback: last non-empty line
  const lines = text.split("\n").filter((l) => l.trim());
  return lines[lines.length - 1] ?? "";
}

// ─── DM commands ─────────────────────────────────────────────────────────────

async function cmdStatus(chatId: number): Promise<void> {
  const raw = await runScript("scripts/health-check.ts", []);
  const health = JSON.parse(raw) as {
    counts: { articles: number; summaries: number; predictions: number; pendingArticles: number };
    agents: { name: string; isActive: boolean; lastError: string | null }[];
    scrapegraph?: { ok: boolean; models?: { queryExpand?: string; sgai?: string } };
  };
  const db = getOpenClawDb();
  const costs = await db.costLog.findMany({
    where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
    select: { totalCostUsd: true },
  });
  const spent = costs.reduce((s, c) => s + c.totalCostUsd, 0);
  const pct = Math.round((spent / MONTHLY_BUDGET) * 100);
  const active = health.agents.filter((a) => a.isActive).length;
  const sg = health.scrapegraph;
  const scoutLine = sg
    ? `\n<b>Scout v3:</b>\n• Sidecar: ${sg.ok ? "✅ OK" : "⚠️ down (Cheerio/snippets only)"}\n• Models: <code>${sg.models?.queryExpand ?? "?"}</code> / <code>${sg.models?.sgai ?? "?"}</code>\n`
    : "";
  await send(
    chatId,
    `<b>📊 Info-Sentry Status</b>\n\n` +
      `<b>Data:</b>\n` +
      `• Articles: ${health.counts.articles}\n` +
      `• Summaries: ${health.counts.summaries}\n` +
      `• Predictions: ${health.counts.predictions}\n` +
      `• Pending: ${health.counts.pendingArticles}\n\n` +
      `<b>Agents:</b> ${active}/5 active\n` +
      scoutLine +
      `\n<b>Budget:</b> $${spent.toFixed(4)} / $${MONTHLY_BUDGET.toFixed(2)} (${pct}%)\n\n` +
      `✅ System operational`,
  );
}

async function cmdBudget(chatId: number): Promise<void> {
  const raw = await runScript("scripts/budget-check.ts", []);
  const b = JSON.parse(raw) as {
    monthlySpendUsd: number;
    todaySpendUsd: number;
    budgetLimitUsd: number;
    remainingUsd: number;
    percentUsedToday: number;
    spendByAgent: Record<string, number>;
  };
  const bar =
    "█".repeat(Math.min(10, Math.round(b.percentUsedToday * 10))) +
    "░".repeat(Math.max(0, 10 - Math.round(b.percentUsedToday * 10)));
  const byAgent = Object.entries(b.spendByAgent)
    .map(([k, v]) => `  ${k}: $${v.toFixed(4)}`)
    .join("\n");
  await send(
    chatId,
    `<b>💰 Budget</b>\n\n` +
      `Monthly limit: <code>$${b.budgetLimitUsd.toFixed(2)}</code>\n` +
      `Spent (month): <code>$${b.monthlySpendUsd.toFixed(4)}</code>\n` +
      `Spent (today): <code>$${b.todaySpendUsd.toFixed(4)}</code>\n` +
      `Remaining: <code>$${b.remainingUsd.toFixed(2)}</code>\n\n` +
      `Today: <code>[${bar}] ${(b.percentUsedToday * 100).toFixed(1)}%</code>\n\n` +
      `<b>By agent:</b>\n<code>${byAgent || "  no spend yet"}</code>`,
  );
}

async function cmdPending(chatId: number): Promise<void> {
  const db = getOpenClawDb();
  const pending = await db.validationQueue.findMany({
    where: { status: "PENDING" },
    orderBy: { submittedAt: "asc" },
    take: 5,
  });
  if (pending.length === 0) {
    await send(chatId, "✅ <b>No pending validations!</b>\n\nAll predictions are approved.");
    return;
  }
  let msg = `<b>⏳ Pending Approvals (${pending.length})</b>\n\n`;
  for (const p of pending.slice(0, 3)) {
    msg += `<code>${p.id.slice(0, 8)}</code> — <b>${(p.confidence * 100).toFixed(0)}% confidence</b>\n`;
    msg += `<i>${p.summary.slice(0, 100)}...</i>\n\n`;
  }
  if (pending.length > 3) msg += `<i>...and ${pending.length - 3} more</i>`;
  await send(chatId, msg);
}

async function cmdRun(chatId: number): Promise<void> {
  await send(
    chatId,
    "🚀 <b>Pipeline starting...</b>\n\n" +
      "1️⃣ Scraping sources (Scout v3)\n2️⃣ Analyzing with AI\n3️⃣ Generating predictions\n4️⃣ Posting to supergroup\n\n" +
      `⏱️ Scout may take several minutes (cap ${Math.round(SCOUT_SCRIPT_TIMEOUT_MS / 60_000)}m). Run <code>docker compose up -d scrapegraph</code> for LLM extraction.`,
  );
  exec("npx", ["tsx", "scripts/scout-run.ts"], {
    cwd: process.cwd(),
    env: process.env,
    timeout: SCOUT_SCRIPT_TIMEOUT_MS,
  })
    .then(() =>
      exec("npx", ["tsx", "scripts/pipeline-run.ts"], {
        cwd: process.cwd(),
        env: process.env,
        timeout: 300_000,
      }),
    )
    .then(() => send(chatId, "✅ <b>Pipeline complete!</b> Check your supergroup for new posts."))
    .catch((err: Error) => send(chatId, `❌ Pipeline failed: ${err.message.slice(0, 200)}`));
}

async function handleCommand(chatId: number, text: string): Promise<void> {
  const cmd = text.split(" ")[0]?.toLowerCase() ?? "";
  try {
    switch (cmd) {
      case "/start":
        await send(
          chatId,
          `👋 <b>Info-Sentry Bot</b>\n\n` +
            `Your personal AI news intelligence system.\n\n` +
            `<b>Commands:</b>\n` +
            `/status — System health &amp; stats\n` +
            `/budget — Monthly spending\n` +
            `/pending — Predictions awaiting approval\n` +
            `/run — Trigger pipeline now\n` +
            `/help — Show this menu`,
        );
        break;
      case "/help":
        await send(
          chatId,
          `<b>Info-Sentry Commands</b>\n\n` +
            `/status — Live system stats\n` +
            `/budget — Current spending breakdown\n` +
            `/pending — Predictions awaiting approval\n` +
            `/run — Start scrape + analyze + predict now\n\n` +
            `<b>Supergroup buttons:</b>\n` +
            `👍 👎 — Tune your interests\n` +
            `🔍 More on this — See topics\n` +
            `🔇 Mute source — Stop scraping that site\n` +
            `📌 Track — Watch a prediction\n` +
            `🗑️ Dismiss — Ignore a prediction`,
        );
        break;
      case "/status":
        await cmdStatus(chatId);
        break;
      case "/budget":
        await cmdBudget(chatId);
        break;
      case "/pending":
        await cmdPending(chatId);
        break;
      case "/run":
        await cmdRun(chatId);
        break;
      default:
        await send(chatId, `❓ Unknown command. Try /help`);
    }
  } catch (err) {
    await send(chatId, `❌ Error: ${(err as Error).message.slice(0, 200)}`);
  }
}

// ─── Callback handlers ────────────────────────────────────────────────────────

async function handleCallback(cb: NonNullable<TelegramUpdate["callback_query"]>): Promise<void> {
  const data = cb.data ?? "";
  const db = getOpenClawDb();

  try {
    if (data.startsWith("like_summary_")) {
      const summaryId = data.slice("like_summary_".length);
      await runScript("scripts/db-query.ts", ["summary", "feedback", `--summaryId=${summaryId}`, "--action=like"]);
      await answerCb(cb.id, "👍 Got it! More like this.");

    } else if (data.startsWith("dislike_summary_")) {
      const summaryId = data.slice("dislike_summary_".length);
      await runScript("scripts/db-query.ts", ["summary", "feedback", `--summaryId=${summaryId}`, "--action=dislike"]);
      await answerCb(cb.id, "👎 Noted. Less of this going forward.");

    } else if (data.startsWith("more_topic_")) {
      const summaryId = data.slice("more_topic_".length);
      const summary = await db.summary.findUnique({ where: { id: summaryId }, select: { keyTopics: true } });
      const topics = summary?.keyTopics.join(", ") ?? "unknown";
      await answerCb(cb.id, `Topics: ${topics}`);
      if (cb.message?.chat.id) {
        await send(cb.message.chat.id, `🔍 <b>Topics in this article:</b>\n${summary?.keyTopics.map((t) => `• ${t}`).join("\n") ?? "None"}`);
      }

    } else if (data.startsWith("mute_source_")) {
      const summaryId = data.slice("mute_source_".length);
      const summary = await db.summary.findUnique({
        where: { id: summaryId },
        include: { article: { include: { source: { select: { id: true, name: true } } } } },
      });
      if (summary?.article.source) {
        await runScript("scripts/db-query.ts", ["source", "mute", `--sourceId=${summary.article.source.id}`]);
        await answerCb(cb.id, `🔇 Muted: ${summary.article.source.name}`, true);
      } else {
        await answerCb(cb.id, "Source not found");
      }

    } else if (data.startsWith("track_prediction_")) {
      await answerCb(cb.id, "📌 Tracking this prediction!");

    } else if (data.startsWith("dismiss_prediction_")) {
      const predictionId = data.slice("dismiss_prediction_".length);
      await db.prediction.update({ where: { id: predictionId }, data: { status: "EXPIRED" } }).catch(() => {});
      await answerCb(cb.id, "🗑️ Dismissed.");

    } else {
      await answerCb(cb.id, "Done");
    }
  } catch (err) {
    console.error("[bot] Callback error:", (err as Error).message);
    await answerCb(cb.id, "❌ Error processing request");
  }
}

// ─── Feedback topic handler ───────────────────────────────────────────────────

async function handleFeedback(chatId: number, threadId: number, text: string): Promise<void> {
  const db = getOpenClawDb();
  const lower = text.toLowerCase().trim();
  const reply = (msg: string) => send(chatId, msg, { message_thread_id: threadId });

  // List interests
  if (/^(list|show interests?|what am i tracking|my interests?)/.test(lower)) {
    const interests = await db.interest.findMany({
      where: { userId: USER_ID, isActive: true },
      orderBy: { score: "desc" },
    });
    if (interests.length === 0) {
      await reply("📋 No active interests. Say <b>add [topic]</b> to start tracking something.");
      return;
    }
    const list = interests
      .map((i) => `• <b>${i.topic}</b> (score: ${i.score.toFixed(1)})${i.description ? `\n  <i>${i.description.slice(0, 80)}...</i>` : ""}`)
      .join("\n\n");
    await reply(`📋 <b>Active Interests (${interests.length})</b>\n\n${list}`);
    return;
  }

  // Add interest: "add [topic]" or "track [topic]"
  const addMatch = lower.match(/^(?:add|track|follow|watch|monitor)\s+(.+)/);
  if (addMatch?.[1]) {
    const topic = addMatch[1].trim();
    const existing = await db.interest.findFirst({
      where: { userId: USER_ID, topic: { equals: topic, mode: "insensitive" } },
    });
    if (existing) {
      if (!existing.isActive) {
        await db.interest.update({ where: { id: existing.id }, data: { isActive: true, score: 1.0 } });
        await reply(`✅ <b>Reactivated:</b> ${existing.topic}\n\nScout will pick it up next hourly run.`);
      } else {
        await reply(`ℹ️ Already tracking <b>${existing.topic}</b>`);
      }
      return;
    }
    const interest = await db.interest.create({ data: { userId: USER_ID, topic, score: 1.0 } });
    console.log("[bot] Feedback: added interest", interest.id, topic);
    await reply(`✅ <b>Now tracking:</b> ${topic}\n\nScout picks up articles every hour. Use <b>add [topic] - [description]</b> for a more specific focus.`);
    return;
  }

  // Remove interest: "remove [topic]", "stop [topic]", "delete [topic]"
  const removeMatch = lower.match(/^(?:remove|stop|delete|drop|untrack)\s+(.+)/);
  if (removeMatch?.[1]) {
    const query = removeMatch[1].trim();
    const interest = await db.interest.findFirst({
      where: { userId: USER_ID, topic: { contains: query, mode: "insensitive" }, isActive: true },
    });
    if (!interest) {
      const all = await db.interest.findMany({ where: { userId: USER_ID, isActive: true }, select: { topic: true } });
      await reply(`❌ Not found. Active interests:\n${all.map((i) => `• ${i.topic}`).join("\n")}\n\nTry <b>remove [exact topic name]</b>`);
      return;
    }
    await db.interest.update({ where: { id: interest.id }, data: { isActive: false } });
    await reply(`🗑️ <b>Stopped tracking:</b> ${interest.topic}`);
    return;
  }

  // Update/describe interest: "describe [topic] as [description]"
  const descMatch = lower.match(/^(?:describe|update|set)\s+(.+?)\s+(?:as|to|:)\s+(.+)/);
  if (descMatch?.[1] && descMatch[2]) {
    const query = descMatch[1].trim();
    const desc = text.slice(text.toLowerCase().indexOf(descMatch[2])).trim();
    const interest = await db.interest.findFirst({
      where: { userId: USER_ID, topic: { contains: query, mode: "insensitive" }, isActive: true },
    });
    if (!interest) {
      await reply(`❌ Interest not found: ${query}`);
      return;
    }
    await db.interest.update({ where: { id: interest.id }, data: { description: desc } });
    await reply(`✅ Updated description for <b>${interest.topic}</b>`);
    return;
  }

  // Boost interest score: "boost [topic]" or "more [topic]"
  const boostMatch = lower.match(/^(?:boost|more|increase)\s+(.+)/);
  if (boostMatch?.[1]) {
    const query = boostMatch[1].trim();
    const interest = await db.interest.findFirst({
      where: { userId: USER_ID, topic: { contains: query, mode: "insensitive" }, isActive: true },
    });
    if (!interest) { await reply(`❌ Interest not found: ${query}`); return; }
    const newScore = Math.min(5.0, interest.score + 0.5);
    await db.interest.update({ where: { id: interest.id }, data: { score: newScore } });
    await reply(`📈 Boosted <b>${interest.topic}</b> score: ${interest.score.toFixed(1)} → ${newScore.toFixed(1)}`);
    return;
  }

  // Default: show help
  await reply(
    `<b>💬 Feedback — Interest Manager</b>\n\n` +
      `<b>add</b> [topic] — Start tracking a new topic\n` +
      `<b>remove</b> [topic] — Stop tracking a topic\n` +
      `<b>list</b> — Show all tracked interests\n` +
      `<b>boost</b> [topic] — Prioritise a topic higher\n` +
      `<b>describe</b> [topic] as [desc] — Refine focus\n\n` +
      `<b>Examples:</b>\n` +
      `<i>add Ontario housing policy</i>\n` +
      `<i>remove AI News</i>\n` +
      `<i>describe Canadian PR Pathways as focus on CEC and OINP tech draws only</i>\n` +
      `<i>boost Canadian PR Pathways</i>`,
  );
}

// ─── Poll loop ────────────────────────────────────────────────────────────────

async function poll(): Promise<void> {
  let offset = 0;

  console.log("[bot] Info-Sentry bot starting...");
  console.log("[bot] Admin:", ADMIN_ID, "| Supergroup:", SUPERGROUP_ID || "not set");

  await send(parseInt(ADMIN_ID), "✅ <b>Info-Sentry bot online!</b>\nSend /help to see commands.").catch(() => {});

  while (true) {
    try {
      const url =
        `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates` +
        `?offset=${offset}&limit=20&timeout=30` +
        `&allowed_updates=["message","callback_query"]`;

      const res = await fetch(url, { signal: AbortSignal.timeout(35_000) });
      const data = (await res.json()) as { ok: boolean; result: TelegramUpdate[] };

      if (!data.ok) {
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }

      for (const update of data.result) {
        offset = Math.max(offset, update.update_id + 1);

        // Callback queries — from any chat (DM or supergroup buttons)
        if (update.callback_query) {
          void handleCallback(update.callback_query);
          continue;
        }

        // Messages — DM commands from admin, or slash commands in supergroup
        const msg = update.message;
        if (!msg?.text) continue;

        const isAdmin = msg.from.id.toString() === ADMIN_ID;
        const isPrivate = msg.chat.type === "private";
        const isOurGroup = SUPERGROUP_ID && msg.chat.id.toString() === SUPERGROUP_ID;
        const threadId = msg.message_thread_id;

        if (isAdmin && isPrivate) {
          console.log("[bot] DM command:", msg.text);
          void handleCommand(msg.chat.id, msg.text);
        } else if (isAdmin && isOurGroup && threadId === FEEDBACK_THREAD_ID) {
          console.log("[bot] Feedback:", msg.text);
          void handleFeedback(msg.chat.id, threadId, msg.text);
        } else if (isAdmin && isOurGroup && msg.text.startsWith("/")) {
          console.log("[bot] Group command:", msg.text);
          void handleCommand(msg.chat.id, msg.text);
        }
      }
    } catch (err) {
      if ((err as Error).name !== "TimeoutError") {
        console.error("[bot] Poll error:", (err as Error).message);
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  }
}

poll().catch((err) => {
  console.error("[bot] Fatal:", err);
  process.exit(1);
});
