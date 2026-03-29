#!/usr/bin/env tsx
/**
 * db-query.ts — Unified DB CLI for OpenClaw agents.
 *
 * Usage: npx tsx scripts/db-query.ts <resource> <action> [--key=value ...]
 *
 * Resources & actions:
 *   user ensure --telegramId=123 [--username=foo]
 *   user interests --userId=abc
 *   chat history --userId=abc [--limit=20]
 *   chat save --userId=abc --role=USER --content="hi" --agentName=feedback
 *   interest adjust --interestId=abc --delta=0.2
 *   interest add --userId=abc --topic="AI" [--description="..."]
 *   interest deactivate --interestId=abc
 *   summary feedback --summaryId=abc --action=like|dislike
 *   summary get --summaryId=abc
 *   source mute --sourceId=abc
 *   agent-config list
 *   agent-config update --agentName=scout --isActive=true
 *   agent-config record-run --agentName=scout [--error="msg"]
 *   article list-scraped [--limit=50]
 *   article get-content --articleId=abc
 *   forum-topic get --name=Main-News
 *   forum-topic ensure-all
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { getOpenClawDb, disconnectAll } from "./lib/prisma.js";

// ─── Arg parser ─────────────────────────────────────────────

function parseArgs(argv: string[]): { resource: string; action: string; flags: Record<string, string> } {
  const resource = argv[2] ?? "";
  const action = argv[3] ?? "";
  const flags: Record<string, string> = {};

  for (let i = 4; i < argv.length; i++) {
    const arg = argv[i]!;
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match?.[1] && match[2] !== undefined) {
      flags[match[1]] = match[2];
    }
  }

  return { resource, action, flags };
}

function require(flags: Record<string, string>, ...keys: string[]): void {
  for (const key of keys) {
    if (!flags[key]) {
      console.error(`Missing required flag: --${key}`);
      process.exit(1);
    }
  }
}

// ─── Handlers ───────────────────────────────────────────────

async function handleUser(action: string, flags: Record<string, string>): Promise<unknown> {
  const db = getOpenClawDb();

  switch (action) {
    case "ensure": {
      require(flags, "telegramId");
      return db.user.upsert({
        where: { telegramId: flags["telegramId"]! },
        update: { username: flags["username"] ?? undefined },
        create: {
          telegramId: flags["telegramId"]!,
          username: flags["username"],
          isAdmin: false,
        },
        select: { id: true, telegramId: true, isAdmin: true },
      });
    }
    case "interests": {
      require(flags, "userId");
      return db.interest.findMany({
        where: { userId: flags["userId"]! },
        select: { id: true, topic: true, score: true, isActive: true },
        orderBy: { score: "desc" },
      });
    }
    default:
      throw new Error(`Unknown user action: ${action}`);
  }
}

async function handleChat(action: string, flags: Record<string, string>): Promise<unknown> {
  const db = getOpenClawDb();

  switch (action) {
    case "history": {
      require(flags, "userId");
      const limit = parseInt(flags["limit"] ?? "20", 10);
      const messages = await db.chatMessage.findMany({
        where: { userId: flags["userId"]! },
        select: { role: true, content: true, agentName: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: limit,
      });
      return messages.reverse();
    }
    case "save": {
      require(flags, "userId", "role", "content", "agentName");
      return db.chatMessage.create({
        data: {
          userId: flags["userId"]!,
          role: flags["role"] as "USER" | "ASSISTANT" | "SYSTEM",
          content: flags["content"]!,
          agentName: flags["agentName"]!,
        },
      });
    }
    default:
      throw new Error(`Unknown chat action: ${action}`);
  }
}

async function handleInterest(action: string, flags: Record<string, string>): Promise<unknown> {
  const db = getOpenClawDb();

  switch (action) {
    case "adjust": {
      require(flags, "interestId", "delta");
      const interest = await db.interest.findUniqueOrThrow({
        where: { id: flags["interestId"]! },
        select: { score: true },
      });
      const newScore = Math.max(0, Math.min(2, interest.score + parseFloat(flags["delta"]!)));
      return db.interest.update({
        where: { id: flags["interestId"]! },
        data: { score: newScore },
        select: { id: true, topic: true, score: true },
      });
    }
    case "add": {
      require(flags, "userId", "topic");
      return db.interest.upsert({
        where: { userId_topic: { userId: flags["userId"]!, topic: flags["topic"]! } },
        update: { isActive: true, description: flags["description"] ?? undefined },
        create: {
          userId: flags["userId"]!,
          topic: flags["topic"]!,
          description: flags["description"],
          score: 1.0,
          isActive: true,
        },
        select: { id: true, topic: true, score: true },
      });
    }
    case "deactivate": {
      require(flags, "interestId");
      return db.interest.update({
        where: { id: flags["interestId"]! },
        data: { isActive: false },
        select: { id: true, topic: true, isActive: true },
      });
    }
    default:
      throw new Error(`Unknown interest action: ${action}`);
  }
}

async function handleSummary(action: string, flags: Record<string, string>): Promise<unknown> {
  const db = getOpenClawDb();

  switch (action) {
    case "feedback": {
      require(flags, "summaryId", "action");
      const summary = await db.summary.findUniqueOrThrow({
        where: { id: flags["summaryId"]! },
        select: { articleId: true, relevanceScore: true },
      });
      const delta = flags["action"] === "like" ? 0.1 : -0.1;
      const newScore = Math.max(0, Math.min(1, (summary.relevanceScore ?? 0.5) + delta));
      return db.summary.update({
        where: { id: flags["summaryId"]! },
        data: { relevanceScore: newScore },
        select: { id: true, relevanceScore: true },
      });
    }
    case "get": {
      require(flags, "summaryId");
      return db.summary.findUniqueOrThrow({
        where: { id: flags["summaryId"]! },
        select: { id: true, content: true, keyTopics: true, articleId: true, sentimentScore: true, relevanceScore: true },
      });
    }
    default:
      throw new Error(`Unknown summary action: ${action}`);
  }
}

async function handleSource(action: string, flags: Record<string, string>): Promise<unknown> {
  const db = getOpenClawDb();

  switch (action) {
    case "mute": {
      require(flags, "sourceId");
      return db.source.update({
        where: { id: flags["sourceId"]! },
        data: { isActive: false },
        select: { id: true, name: true, isActive: true },
      });
    }
    default:
      throw new Error(`Unknown source action: ${action}`);
  }
}

async function handleAgentConfig(action: string, flags: Record<string, string>): Promise<unknown> {
  const db = getOpenClawDb();

  switch (action) {
    case "list": {
      return db.agentConfig.findMany({
        select: { agentName: true, isActive: true, cronSchedule: true, settings: true, lastRunAt: true, lastError: true },
        orderBy: { agentName: "asc" },
      });
    }
    case "update": {
      require(flags, "agentName");
      const data: Record<string, unknown> = {};
      if (flags["isActive"] !== undefined) data["isActive"] = flags["isActive"] === "true";
      if (flags["cronSchedule"] !== undefined) data["cronSchedule"] = flags["cronSchedule"] || null;
      if (flags["lastError"] !== undefined) data["lastError"] = flags["lastError"] || null;
      return db.agentConfig.update({
        where: { agentName: flags["agentName"]! },
        data,
        select: { agentName: true, isActive: true, cronSchedule: true },
      });
    }
    case "record-run": {
      require(flags, "agentName");
      return db.agentConfig.update({
        where: { agentName: flags["agentName"]! },
        data: { lastRunAt: new Date(), lastError: flags["error"] ?? null },
      });
    }
    default:
      throw new Error(`Unknown agent-config action: ${action}`);
  }
}

async function handleArticle(action: string, flags: Record<string, string>): Promise<unknown> {
  const db = getOpenClawDb();

  switch (action) {
    case "list-scraped": {
      const limit = parseInt(flags["limit"] ?? "50", 10);
      return db.article.findMany({
        where: { status: "SCRAPED" },
        select: { id: true, sourceId: true, url: true, title: true, rawFilePath: true, scrapedAt: true },
        orderBy: { scrapedAt: "asc" },
        take: limit,
      });
    }
    case "get-content": {
      require(flags, "articleId");
      const article = await db.article.findUniqueOrThrow({
        where: { id: flags["articleId"]! },
        select: { rawFilePath: true },
      });
      if (!article.rawFilePath) throw new Error(`Article ${flags["articleId"]} has no rawFilePath`);
      return readFile(article.rawFilePath, "utf-8");
    }
    default:
      throw new Error(`Unknown article action: ${action}`);
  }
}

async function handleForumTopic(action: string, flags: Record<string, string>): Promise<unknown> {
  const db = getOpenClawDb();

  switch (action) {
    case "get": {
      require(flags, "name");
      return db.forumTopic.findUnique({ where: { name: flags["name"]! } });
    }
    case "ensure-all": {
      const REQUIRED = [
        { name: "Main-News", iconColor: 0x6fb9f0 },
        { name: "Predictions", iconColor: 0xffd67e },
        { name: "Feedback", iconColor: 0xcb86db },
        { name: "System-Log", iconColor: 0x8eee98 },
      ];
      const results: { name: string; status: string; telegramTopicId?: number }[] = [];
      const botToken = process.env["TELEGRAM_BOT_TOKEN"];
      const chatId = process.env["TELEGRAM_SUPERGROUP_ID"];
      if (!botToken || !chatId) throw new Error("TELEGRAM_BOT_TOKEN and TELEGRAM_SUPERGROUP_ID required");

      for (const topic of REQUIRED) {
        const existing = await db.forumTopic.findUnique({ where: { name: topic.name } });
        if (existing) {
          results.push({ name: topic.name, status: "exists", telegramTopicId: existing.telegramTopicId });
          continue;
        }
        // Create via Telegram Bot API
        const res = await fetch(`https://api.telegram.org/bot${botToken}/createForumTopic`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, name: topic.name, icon_color: topic.iconColor }),
        });
        const data = (await res.json()) as { ok: boolean; result?: { message_thread_id: number } };
        if (!data.ok || !data.result) {
          results.push({ name: topic.name, status: "failed" });
          continue;
        }
        await db.forumTopic.create({
          data: { name: topic.name, telegramTopicId: data.result.message_thread_id },
        });
        results.push({ name: topic.name, status: "created", telegramTopicId: data.result.message_thread_id });
      }
      return results;
    }
    default:
      throw new Error(`Unknown forum-topic action: ${action}`);
  }
}

// ─── Main ───────────────────────────────────────────────────

const HANDLERS: Record<string, (action: string, flags: Record<string, string>) => Promise<unknown>> = {
  user: handleUser,
  chat: handleChat,
  interest: handleInterest,
  summary: handleSummary,
  source: handleSource,
  "agent-config": handleAgentConfig,
  article: handleArticle,
  "forum-topic": handleForumTopic,
};

async function main(): Promise<void> {
  const { resource, action, flags } = parseArgs(process.argv);

  const handler = HANDLERS[resource];
  if (!handler) {
    console.error(`Unknown resource: ${resource}`);
    console.error(`Available: ${Object.keys(HANDLERS).join(", ")}`);
    process.exit(1);
  }

  try {
    const result = await handler(action, flags);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  } finally {
    await disconnectAll();
  }
}

main();
