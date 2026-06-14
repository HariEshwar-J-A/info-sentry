#!/usr/bin/env tsx
/**
 * prediction-verifier.ts — Verify PENDING predictions using recent articles +
 * DuckDuckGo web search, resolved by kimi-k2.6 deep reasoning.
 *
 * Usage: npx tsx scripts/prediction-verifier.ts [--dryRun]
 *
 * Logic:
 *   1. Fetches PENDING predictions that are trackedByUser OR dueDate within 7 days
 *   2. Collects evidence: DB articles (last 48h) + DuckDuckGo HTML scrape (top 5)
 *   3. Calls kimi-k2.6 for chain-of-thought verdict: CORRECT | INCORRECT |
 *      PARTIALLY_CORRECT | NO_EVIDENCE_YET
 *   4. If verdict is not NO_EVIDENCE_YET: updates Prediction, creates Notification,
 *      posts to Telegram
 */
import "dotenv/config";
import { getOpenClawDb, disconnectAll } from "./lib/prisma.js";
import { articleWhereScoped, pipelineUserIdFromEnv } from "./lib/pipeline-scope.js";
import { chatCompletion } from "./lib/openrouter.js";
import { logCost, canSpend } from "./lib/budget.js";
import { KIMI_K2 } from "./lib/models.js";

const DRY_RUN = process.argv.includes("--dryRun");
const LEGACY_OWNER_USER_ID = process.env["OWNER_USER_ID"] ?? "cmoi886x30000z57fqxkeg2ms";

// ─── DuckDuckGo HTML search ───────────────────────────────────────────────────

interface SearchResult {
  title: string;
  snippet: string;
  url: string;
}

async function duckduckgoSearch(query: string, maxResults = 5): Promise<SearchResult[]> {
  try {
    const encoded = encodeURIComponent(query);
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encoded}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept": "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(12_000),
    });

    if (!res.ok) return [];
    const html = await res.text();

    const results: SearchResult[] = [];

    // DDG HTML: result titles in <a class="result__a">, snippets in <a class="result__snippet">
    // Use a two-pass approach — find result blocks
    const blockRe = /<div[^>]+class="[^"]*result__body[^"]*"[^>]*>([\s\S]*?)<\/div>/g;
    let block: RegExpExecArray | null;

    while ((block = blockRe.exec(html)) !== null && results.length < maxResults) {
      const bodyHtml = block[1] ?? "";

      const titleMatch = bodyHtml.match(/<a[^>]+class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/);
      const snippetMatch = bodyHtml.match(/<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);

      if (!titleMatch || !snippetMatch) continue;

      const rawUrl = titleMatch[1] ?? "";
      const rawTitle = (titleMatch[2] ?? "").replace(/<[^>]+>/g, "").trim();
      const rawSnippet = (snippetMatch[1] ?? "").replace(/<[^>]+>/g, "").trim();

      if (!rawTitle || !rawSnippet) continue;

      // Decode DDG redirect URLs
      let actualUrl = rawUrl;
      const uddg = rawUrl.match(/uddg=([^&]+)/);
      if (uddg?.[1]) {
        try { actualUrl = decodeURIComponent(uddg[1]); } catch { /* keep */ }
      }

      results.push({ title: rawTitle, snippet: rawSnippet, url: actualUrl });
    }

    console.log(`[verifier] Search "${query.slice(0, 60)}…" → ${results.length} results`);
    return results;
  } catch (err) {
    console.warn("[verifier] DDG search failed:", (err as Error).message);
    return [];
  }
}

import { postToTopic, escHtml } from "./lib/telegram.js";

// ─── LLM verdict ─────────────────────────────────────────────────────────────

type Verdict = "CORRECT" | "INCORRECT" | "PARTIALLY_CORRECT" | "NO_EVIDENCE_YET";

interface VerdictResponse {
  verdict: Verdict;
  confidence: number;
  resolutionAnalysis: string;
  keyEvidence: string[];
  reliableSources: string[];
  unreliableSources: string[];
  whatWasRight: string;
  whatWasWrong: string;
  initialConsiderations: string;
  actualOutcome: string;
}

const SYSTEM_PROMPT = `You are the Prediction Verifier for Info-Sentry, a personal AI news intelligence system.

Your task: determine whether a prediction has come true, using recent news and web search evidence.

Evaluate each piece of evidence critically:
- Assess source reliability (major outlets vs blogs, primary vs secondary sources)
- Look for corroborating evidence across multiple independent sources
- Be explicit about what confirms vs what contradicts
- Be rigorous: do NOT upgrade NO_EVIDENCE_YET unless you have concrete evidence

Return ONLY a JSON object (no markdown fences):
{
  "verdict": "CORRECT" | "INCORRECT" | "PARTIALLY_CORRECT" | "NO_EVIDENCE_YET",
  "confidence": 0.0,
  "resolutionAnalysis": "3-5 sentence detailed analysis of the outcome and reasoning",
  "keyEvidence": ["specific evidence item 1", "item 2"],
  "reliableSources": ["url1"],
  "unreliableSources": ["url2"],
  "whatWasRight": "What aspects of the prediction proved accurate",
  "whatWasWrong": "What aspects were inaccurate or missed",
  "initialConsiderations": "What the prediction likely anticipated would happen",
  "actualOutcome": "What actually happened based on the evidence"
}

Verdict rules:
- CORRECT: Strong, direct evidence the prediction came true
- INCORRECT: Strong, direct evidence it did not
- PARTIALLY_CORRECT: Directionally right but wrong in magnitude, timing, or specifics
- NO_EVIDENCE_YET: Insufficient evidence — horizon may not have elapsed, topic not in recent news`;

async function verifyPrediction(
  prediction: {
    id: string;
    content: string;
    confidence: number;
    timeHorizon: string | null;
    dueDate: Date | null;
    trackedByUser: boolean;
    createdAt: Date;
    articleId: string;
    article: {
      title: string;
      url: string;
      summary: { content: string; keyTopics: string[] } | null;
    };
  },
  recentArticles: {
    source: { name: string; trustScore: number };
    summary: { content: string; keyTopics: string[] } | null;
    scrapedAt: Date;
  }[],
): Promise<VerdictResponse | null> {
  const predTopics = prediction.article.summary?.keyTopics ?? [];

  // Filter relevant recent articles by topic overlap
  const relevant = recentArticles
    .filter((a) => {
      const t = a.summary?.keyTopics ?? [];
      return t.some((topic) => predTopics.some((p) => p.toLowerCase().includes(topic.toLowerCase()) || topic.toLowerCase().includes(p.toLowerCase())));
    })
    .slice(0, 8);

  const articleCtx = relevant.length > 0
    ? relevant.map((a, i) =>
        `[DB ${i + 1}] ${a.source.name} (trust: ${a.source.trustScore.toFixed(2)}) · ${Math.floor((Date.now() - a.scrapedAt.getTime()) / 3_600_000)}h ago\n${(a.summary?.content ?? "").slice(0, 500)}`
      ).join("\n\n---\n\n")
    : "No matching articles in database.";

  // Web search — use prediction content + key topics as query
  const searchQuery = `${prediction.content.slice(0, 120)} ${predTopics.slice(0, 3).join(" ")}`;
  const searchResults = await duckduckgoSearch(searchQuery, 5);

  // Also search for article title to see if there are follow-ups
  const titleResults = await duckduckgoSearch(`${prediction.article.title.slice(0, 80)} latest news`, 3);
  const allResults = [...searchResults, ...titleResults];

  const searchCtx = allResults.length > 0
    ? allResults.map((r, i) =>
        `[Web ${i + 1}] ${r.title}\nURL: ${r.url}\nSnippet: ${r.snippet}`
      ).join("\n\n---\n\n")
    : "No web search results.";

  const userPrompt = `PREDICTION TO VERIFY:
Text: "${prediction.content}"
Original confidence: ${Math.round(prediction.confidence * 100)}%
Time horizon: ${prediction.timeHorizon ?? "unspecified"}
Created: ${prediction.createdAt.toISOString().slice(0, 10)}
Due date: ${prediction.dueDate?.toISOString().slice(0, 10) ?? "not set"}
Source article: "${prediction.article.title}"
Source URL: ${prediction.article.url}
Key topics: ${predTopics.join(", ")}

RECENT DATABASE ARTICLES (last 48h, topic-matched):
${articleCtx}

WEB SEARCH RESULTS:
${searchCtx}`;

  const response = await chatCompletion(
    KIMI_K2.id,
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    { temperature: 0.2, maxTokens: 1500, responseFormat: { type: "json_object" } },
  );

  await logCost("prediction-verifier", KIMI_K2, response.promptTokens, response.completionTokens, response.generationId);

  // Extract JSON (handle possible markdown fencing from model)
  let jsonText = response.content;
  const fenceMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch?.[1]) jsonText = fenceMatch[1].trim();
  const braceMatch = jsonText.match(/\{[\s\S]*\}/);
  if (braceMatch) jsonText = braceMatch[0];

  try {
    return JSON.parse(jsonText) as VerdictResponse;
  } catch {
    console.error("[verifier] Failed to parse verdict JSON:", response.content.slice(0, 200));
    return null;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  if (!(await canSpend("prediction-verifier"))) {
    console.error("[verifier] Budget exceeded or agent paused — skipping");
    process.exit(0);
  }

  const db = getOpenClawDb();
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const pipelineUserId = pipelineUserIdFromEnv();
  const articleScopeUser = pipelineUserId ? articleWhereScoped({ userId: pipelineUserId }) : undefined;
  const notificationUserId = pipelineUserId ?? LEGACY_OWNER_USER_ID;

  if (pipelineUserId) {
    console.log(`[verifier] Web scope: predictions + article context for user ${pipelineUserId}`);
  }

  // Get PENDING predictions eligible for verification
  const predictions = await db.prediction.findMany({
    where: {
      status: "PENDING",
      OR: [
        { trackedByUser: true },
        { dueDate: { lte: in7Days } },
      ],
      ...(articleScopeUser ? { article: articleScopeUser } : {}),
    },
    include: {
      article: {
        select: {
          title: true,
          url: true,
          summary: { select: { content: true, keyTopics: true } },
        },
      },
    },
    orderBy: [{ trackedByUser: "desc" }, { dueDate: "asc" }, { confidence: "desc" }],
    take: 15, // max 15 per run to control cost
  });

  console.log(`[verifier] ${predictions.length} predictions eligible for verification`);
  if (predictions.length === 0) {
    console.log("[verifier] Nothing to verify. Exiting.");
    await disconnectAll();
    return;
  }

  // Load recent articles for context (shared across all predictions)
  const since48h = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const recentArticles = await db.article.findMany({
    where: {
      scrapedAt: { gte: since48h },
      status: { in: ["SUMMARIZED", "POSTED"] },
      summary: { isNot: null },
      ...(articleScopeUser ?? {}),
    },
    include: {
      summary: { select: { content: true, keyTopics: true } },
      source: { select: { name: true, trustScore: true } },
    },
    orderBy: { scrapedAt: "desc" },
    take: 40,
  });

  console.log(`[verifier] ${recentArticles.length} recent articles loaded for context\n`);

  let verified = 0;
  let noEvidence = 0;

  for (const prediction of predictions) {
    console.log(`\n[verifier] Checking: "${prediction.content.slice(0, 80)}…"`);
    console.log(`[verifier]   Tracked: ${prediction.trackedByUser} | Due: ${prediction.dueDate?.toISOString().slice(0, 10) ?? "none"}`);

    try {
      const result = await verifyPrediction(prediction, recentArticles);
      if (!result) { console.error("[verifier]   Parse failed — skipping"); continue; }

      console.log(`[verifier]   Verdict: ${result.verdict} (${Math.round(result.confidence * 100)}%)`);

      if (result.verdict === "NO_EVIDENCE_YET") {
        noEvidence++;
        continue;
      }

      if (DRY_RUN) {
        console.log(`[verifier]   DRY RUN — would mark ${prediction.id} as ${result.verdict}`);
        console.log(`[verifier]   Analysis: ${result.resolutionAnalysis}`);
        verified++;
        continue;
      }

      // Build rich analysis text
      const fullAnalysis = [
        result.resolutionAnalysis,
        result.initialConsiderations ? `**Initially anticipated:** ${result.initialConsiderations}` : null,
        result.actualOutcome ? `**Actual outcome:** ${result.actualOutcome}` : null,
        result.whatWasRight ? `**What was right:** ${result.whatWasRight}` : null,
        result.whatWasWrong ? `**What was wrong:** ${result.whatWasWrong}` : null,
        result.keyEvidence.length > 0 ? `**Key evidence:** ${result.keyEvidence.join("; ")}` : null,
        result.reliableSources.length > 0 ? `**Reliable sources:** ${result.reliableSources.slice(0, 3).join(", ")}` : null,
      ].filter(Boolean).join("\n\n");

      // Update prediction
      await db.prediction.update({
        where: { id: prediction.id },
        data: {
          status: result.verdict,
          resolvedAt: now,
          outcome: result.verdict,
          resolutionAnalysis: fullAnalysis,
        },
      });

      // Create notification
      const emoji = result.verdict === "CORRECT" ? "✅" : result.verdict === "INCORRECT" ? "❌" : "🔶";
      await db.notification.create({
        data: {
          userId: notificationUserId,
          type: "PREDICTION_VERIFIED",
          title: `${emoji} Prediction ${result.verdict.replace(/_/g, " ")}`,
          body: prediction.content.slice(0, 120) + (prediction.content.length > 120 ? "…" : ""),
          data: {
            predictionId: prediction.id,
            articleId: prediction.articleId,
            verdict: result.verdict,
            confidence: result.confidence,
          },
        },
      });

      // Post resolved prediction to Predictions topic
      await postToTopic("Predictions",
        `${emoji} <b>Prediction Resolved: ${result.verdict.replace(/_/g, " ")}</b>\n\n` +
        `<b>Confidence:</b> ${Math.round(result.confidence * 100)}%\n` +
        `<b>Prediction:</b>\n<i>${escHtml(prediction.content.slice(0, 280))}</i>\n\n` +
        `<b>Analysis:</b>\n${escHtml(result.resolutionAnalysis.slice(0, 500))}\n\n` +
        (result.whatWasRight ? `✓ <b>Right:</b> ${escHtml(result.whatWasRight.slice(0, 150))}\n` : "") +
        (result.whatWasWrong ? `✗ <b>Wrong:</b> ${escHtml(result.whatWasWrong.slice(0, 150))}\n` : "") +
        `\n<i>From: ${escHtml(prediction.article.title.slice(0, 80))}</i>`
      );

      verified++;
      console.log(`[verifier]   ✓ Updated ${prediction.id} → ${result.verdict}`);

      // Rate-limit between predictions
      await new Promise((r) => setTimeout(r, 2500));

    } catch (err) {
      console.error(`[verifier]   Error:`, (err as Error).message);
    }
  }

  console.log(`\n[verifier] Done — Verified: ${verified}, No evidence: ${noEvidence}, Total: ${predictions.length}`);

  // Record run in AgentConfig
  await db.agentConfig.upsert({
    where: { agentName: "prediction-verifier" },
    update: { lastRunAt: now, lastError: null },
    create: { agentName: "prediction-verifier", isActive: true, lastRunAt: now },
  }).catch(() => {});

  await disconnectAll();
}

main().catch((err) => {
  console.error("[verifier] Fatal:", err);
  process.exit(1);
});
