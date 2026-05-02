#!/usr/bin/env tsx
/**
 * telegram-send.ts — Send messages to Telegram with forum topics + inline keyboards.
 *
 * Usage: npx tsx scripts/telegram-send.ts --topic=Main-News --text="Hello world"
 *        npx tsx scripts/telegram-send.ts --chat=ADMIN --text="Error report"
 *        npx tsx scripts/telegram-send.ts --topic=Main-News --text="Summary" --keyboard=summary --id=abc123
 *
 * Keyboard types:
 *   summary   — like/dislike/more/mute buttons (requires --id=summaryId)
 *   prediction — track/dismiss buttons (requires --id=predictionId)
 *   error      — retry/pause/ignore buttons (requires --id=errorId --agent=agentName)
 */
import "dotenv/config";
import { getOpenClawDb, disconnectAll } from "./lib/prisma.js";

const BOT_TOKEN = process.env["TELEGRAM_BOT_TOKEN"]!;
const SUPERGROUP_ID = process.env["TELEGRAM_SUPERGROUP_ID"]!;
const ADMIN_ID = process.env["TELEGRAM_ADMIN_ID"]!;

interface InlineButton {
  text: string;
  callback_data: string;
}

function buildKeyboard(type: string, id: string, agent?: string): InlineButton[][] {
  switch (type) {
    case "summary":
      return [
        [
          { text: "👍 Relevant", callback_data: `like_summary_${id}` },
          { text: "👎 Not for me", callback_data: `dislike_summary_${id}` },
        ],
        [
          { text: "🔍 More on this", callback_data: `more_topic_${id}` },
          { text: "🔇 Mute source", callback_data: `mute_source_${id}` },
        ],
      ];
    case "prediction":
      return [
        [
          { text: "📌 Track this", callback_data: `track_prediction_${id}` },
          { text: "🗑️ Not useful", callback_data: `dismiss_prediction_${id}` },
        ],
      ];
    case "error":
      return [
        [
          { text: "🔄 Retry", callback_data: `retry_${agent ?? "unknown"}_${id}` },
          { text: "⏸️ Pause Agent", callback_data: `pause_${agent ?? "unknown"}` },
        ],
        [{ text: "✅ Ignore", callback_data: `ignore_${id}` }],
      ];
    default:
      return [];
  }
}

async function telegramApi(method: string, body: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { ok: boolean; result?: unknown; description?: string };
  if (!data.ok) {
    throw new Error(`Telegram API ${method} failed: ${data.description ?? "unknown"}`);
  }
  return data.result;
}

function parseArgs(argv: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i]!;
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match?.[1] && match[2] !== undefined) {
      flags[match[1]] = match[2];
    }
  }
  return flags;
}

async function main(): Promise<void> {
  const flags = parseArgs(process.argv);
  let text = flags["text"];
  // Support reading text from stdin for multiline
  if (!text && !process.stdin.isTTY) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    text = Buffer.concat(chunks).toString('utf-8').trim();
  }
  if (!text) {
    console.error("Missing required flag: --text");
    process.exit(1);
  }

  // Determine chat_id and message_thread_id
  let chatId: string;
  let threadId: number | undefined;

  if (flags["chat"] === "ADMIN") {
    chatId = ADMIN_ID;
  } else if (flags["topic"]) {
    chatId = SUPERGROUP_ID;
    const db = getOpenClawDb();
    const topic = await db.forumTopic.findUnique({ where: { name: flags["topic"] } });
    if (!topic) {
      console.error(`Forum topic "${flags["topic"]}" not found in DB. Run: npx tsx scripts/db-query.ts forum-topic ensure-all`);
      process.exit(1);
    }
    threadId = topic.telegramTopicId;
  } else {
    chatId = SUPERGROUP_ID;
  }

  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
  };

  if (threadId !== undefined) {
    body["message_thread_id"] = threadId;
  }

  // Add inline keyboard if requested
  if (flags["keyboard"] && flags["id"]) {
    const keyboard = buildKeyboard(flags["keyboard"], flags["id"], flags["agent"]);
    if (keyboard.length > 0) {
      body["reply_markup"] = { inline_keyboard: keyboard };
    }
  }

  const result = await telegramApi("sendMessage", body);
  console.log(JSON.stringify(result, null, 2));

  await disconnectAll();
}

main();
