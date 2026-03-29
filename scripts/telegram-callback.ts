#!/usr/bin/env tsx
/**
 * telegram-callback.ts — Answer a Telegram inline callback query.
 *
 * Usage: npx tsx scripts/telegram-callback.ts --callbackId=abc123 --text="Done!"
 */
import "dotenv/config";

const BOT_TOKEN = process.env["TELEGRAM_BOT_TOKEN"]!;

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
  const callbackId = flags["callbackId"];
  const text = flags["text"] ?? "Done";

  if (!callbackId) {
    console.error("Missing required flag: --callbackId");
    process.exit(1);
  }

  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callback_query_id: callbackId,
      text,
    }),
  });

  const data = (await res.json()) as { ok: boolean; description?: string };
  if (!data.ok) {
    console.error(`Failed: ${data.description ?? "unknown"}`);
    process.exit(1);
  }

  console.log("Callback answered");
}

main();
