#!/usr/bin/env tsx
/**
 * pipeline-run.ts — Orchestrate the full article pipeline.
 *
 * Triggered by OpenClaw cron every 2h at :15.
 * 1. Queries SCRAPED articles
 * 2. Analyzes each → writes summaries
 * 3. Generates predictions for each summary
 * 4. Posts summaries + predictions to Telegram (WITH FULL CONTENT)
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
  // Return only the last non-empty line — scripts may print log lines before the JSON output
  const lines = stdout.trim().split("\n").filter((l) => l.trim());
  return lines[lines.length - 1] ?? "";
}

const BOT_TOKEN = process.env["TELEGRAM_BOT_TOKEN"]!;
const SUPERGROUP_ID = process.env["TELEGRAM_SUPERGROUP_ID"];
const ADMIN_ID = process.env["TELEGRAM_ADMIN_ID"];

let mainNewsThreadId: number | undefined;
let predictionsThreadId: number | undefined;

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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

async function getTranscriptForArticle(articleId: string): Promise<string | null> {
  const db = getOpenClawDb();
  const media = await db.mediaContent.findFirst({
    where: { articleId, type: { in: ["VIDEO", "AUDIO"] } },
    orderBy: { createdAt: "desc" },
    select: { transcript: true, title: true },
  });
  return media?.transcript || null;
}

async function postSummaryToTelegram(
  articleTitle: string,
  articleUrl: string,
  summary: { summaryId: string; keyTopics: string[]; sentimentScore: number; relevanceScore: number; content?: string },
  fullSummaryContent: string | null,
  transcript: string | null,
): Promise<number | undefined> {
  const sentiment = summary.sentimentScore > 0.3 ? "🟢" : summary.sentimentScore < -0.3 ? "🔴" : "🟡";

  // Build comprehensive report
  const sections: string[] = [];

  // Header
  sections.push(`${sentiment} <b>${escHtml(articleTitle)}</b>`);
  sections.push("");
  
  // Summary content (the actual meat)
  if (fullSummaryContent && fullSummaryContent.length > 20) {
    sections.push("<b>📝 Summary:</b>");
    const summaryParas = fullSummaryContent.split('\n').filter(p => p.trim().length > 0);
    for (const para of summaryParas.slice(0, 5)) {
      sections.push(para.slice(0, 800));
    }
    sections.push("");
  }
  
  // Transcript if available
  if (transcript && transcript.length > 50) {
    const transcriptSnippet = transcript.slice(0, 1200);
    sections.push("<b>🎙️ Key Transcript Excerpt:</b>");
    if (transcriptSnippet.startsWith('[')) {
      sections.push("<i>Timestamped dialogue - showing first ~400 words...</i>");
    }
    sections.push(transcriptSnippet.split('\n').slice(0, 8).join('\n'));
    sections.push(transcript.length > 1200 ? "<i>...[transcript continues]...</i>" : "");
    sections.push("");
  }
  
  // Metadata
  sections.push("<b>📊 Metadata:</b>");
  sections.push(`Topics: ${summary.keyTopics.join(", ")}`);
  sections.push(`Relevance: ${(summary.relevanceScore * 100).toFixed(0)}%`);
  sections.push(`<a href="${encodeURI(articleUrl)}">🔗 Source</a>`);
  
  let text = sections.join("\n");
  
  // Post to supergroup Main-News topic if available, else fall back to admin DM
  const chatId = mainNewsThreadId ? SUPERGROUP_ID : ADMIN_ID;
  const baseBody: Record<string, unknown> = { parse_mode: "HTML" };
  if (mainNewsThreadId) baseBody["message_thread_id"] = mainNewsThreadId;

  const keyboard = {
    inline_keyboard: [
      [
        { text: "👍 Relevant", callback_data: `like_summary_${summary.summaryId}` },
        { text: "👎 Not for me", callback_data: `dislike_summary_${summary.summaryId}` },
      ],
      [
        { text: "🔍 More on this", callback_data: `more_topic_${summary.summaryId}` },
        { text: "🔇 Mute source", callback_data: `mute_source_${summary.summaryId}` },
      ],
    ],
  };

  const MAX_LEN = 4096;
  if (text.length > MAX_LEN) {
    const result1 = await telegramApi("sendMessage", {
      ...baseBody,
      chat_id: chatId,
      text: text.slice(0, MAX_LEN - 3) + "...",
      reply_markup: { inline_keyboard: [keyboard.inline_keyboard[0]!] },
    }) as { message_id: number };
    const part2 = text.slice(MAX_LEN - 3);
    if (part2.length > 0) {
      await telegramApi("sendMessage", {
        ...baseBody,
        chat_id: chatId,
        text: `📄 <i>...continued...</i>\n\n${part2.slice(0, MAX_LEN)}`,
      });
    }
    return result1.message_id;
  }

  const result = await telegramApi("sendMessage", {
    ...baseBody,
    chat_id: chatId,
    text,
    reply_markup: keyboard,
  }) as { message_id: number };

  return result.message_id;
}

async function postPredictionsToTelegram(
  predictions: { predictionId: string; confidence: number; timeHorizon: string }[],
  connectionsToPast: string,
): Promise<number | undefined> {
  if (predictions.length === 0) return;

  const db = getOpenClawDb();
  const lines = [`<b>🔮 Predictions</b>`, ""];

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

  const firstId = predictions[0]?.predictionId ?? "";
  const text = lines.join("\n");
  const truncatedText = text.length > 4000 ? text.slice(0, 3997) + "..." : text;

  const chatId = predictionsThreadId ? SUPERGROUP_ID : ADMIN_ID;
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text: truncatedText,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [[
        { text: "📌 Track this", callback_data: `track_prediction_${firstId}` },
        { text: "🗑️ Not useful", callback_data: `dismiss_prediction_${firstId}` },
      ]],
    },
  };
  if (predictionsThreadId) body["message_thread_id"] = predictionsThreadId;

  const result = await telegramApi("sendMessage", body) as { message_id: number };
  return result.message_id;
}

async function main(): Promise<void> {
  const db = getOpenClawDb();
  console.log("[pipeline] Starting pipeline run");

  // Load forum topic IDs for supergroup posting
  if (SUPERGROUP_ID) {
    const [mainTopic, predTopic] = await Promise.all([
      db.forumTopic.findUnique({ where: { name: "Main-News" } }),
      db.forumTopic.findUnique({ where: { name: "Predictions" } }),
    ]);
    mainNewsThreadId = mainTopic?.telegramTopicId;
    predictionsThreadId = predTopic?.telegramTopicId;
    console.log(`[pipeline] Posting to supergroup topics — Main-News: ${mainNewsThreadId}, Predictions: ${predictionsThreadId}`);
  }

  // 1. Get SCRAPED articles + FAILED articles that have summaries (retry them)
  const articles = await db.article.findMany({
    where: { status: { in: ["SCRAPED", "FAILED"] } },
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

      // Fetch full summary content from DB
      const summaryRecord = await db.summary.findUnique({
        where: { id: analystResult.summaryId },
        select: { content: true },
      });
      const fullSummaryContent = summaryRecord?.content ?? null;

      // Fetch transcript if available
      const transcript = await getTranscriptForArticle(article.id);

      // 3. Post summary to Telegram with full content
      await postSummaryToTelegram(article.title, article.url, {
        ...analystResult,
        content: fullSummaryContent ?? undefined,
      }, fullSummaryContent, transcript);

      // 4. Generate predictions (skip if already created for this article)
      const existingPreds = await db.prediction.findMany({
        where: { articleId: article.id },
        select: { id: true, confidence: true, timeHorizon: true },
      });

      if (existingPreds.length > 0) {
        console.log(`[pipeline] Predictions already exist for: ${article.title}, posting them`);
        const predsToPost = existingPreds.map(p => ({
          predictionId: p.id,
          confidence: p.confidence,
          timeHorizon: p.timeHorizon ?? "unknown",
        }));
        await postPredictionsToTelegram(predsToPost, "");
      } else {
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
