#!/usr/bin/env tsx
/**
 * analyst-process.ts — Analyze a single article via LLM.
 *
 * Usage: npx tsx scripts/analyst-process.ts --articleId=abc123
 *
 * Reads article content, calls OpenRouter (Gemini primary + rate-limit fallbacks), saves summary + ChromaDB.
 * Outputs JSON: { summaryId, chromaId, keyTopics, sentimentScore, relevanceScore }
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { getOpenClawDb, disconnectAll } from "./lib/prisma.js";
import { getChromaClient, COLLECTIONS } from "./lib/chromadb.js";
import { DEEPSEEK_V3, MODELS, TIER_3_BUDGET, type ModelConfig } from "./lib/models.js";
import {
  chatCompletion,
  isOpenRouterKeyLimitExceeded,
  isOpenRouterRateLimitError,
  OPENROUTER_KEY_SETTINGS_URL,
} from "./lib/openrouter.js";
import { logCost, canSpend } from "./lib/budget.js";

interface AnalystLLMResponse {
  summary: string;
  keyTopics: string[];
  sentimentScore: number;
  relevanceScore: number;
  sourceTrustDelta: number;
  sourceTrustReasoning: string;
}

const SYSTEM_PROMPT = `You are the Analyst Agent for Info-Sentry, a personal news intelligence system.

Your role is to analyze raw news articles and produce structured intelligence summaries.

For each article you receive, you MUST return a JSON object with these exact fields:

{
  "summary": "A 2-4 paragraph summary in **markdown format**. Use **bold** for key names, numbers, and dates. Use bullet points for lists of facts. Start with a one-sentence lead. Focus on facts, claims, and implications.",
  "keyTopics": ["array", "of", "3-7", "topic", "tags"],
  "sentimentScore": 0.0,
  "relevanceScore": 0.0,
  "sourceTrustDelta": 0.0,
  "sourceTrustReasoning": "Brief explanation of why you adjusted (or didn't adjust) source trust."
}

Guidelines:
1. SUMMARY: Capture who, what, when, where, why. Include specific numbers, dates, names.
2. KEY TOPICS: Lowercase, specific tags. Prefer established terms.
3. SENTIMENT: -1.0 (very negative) to 1.0 (very positive). 0.0 is neutral.
4. RELEVANCE: 0.0 (irrelevant) to 1.0 (highly relevant).
5. SOURCE TRUST DELTA: -0.1 to 0.1. Adjust for quality/accuracy.

Respond ONLY with the JSON object. No markdown code fences. No extra text.

CRITICAL — valid JSON only: Inside string values you may use markdown (**bold**, bullets).
Use \\n for newlines in "summary". Never use a backslash before * or # or letters (e.g. \\* or \\L are invalid JSON). Use Unicode apostrophes if needed; escape only \\\", \\\\, and \\n.`;

/** Fix LLM output where invalid \\ escapes appear inside JSON strings (e.g. \\*, \\L). */
function repairInvalidJsonEscapes(raw: string): string {
  let out = "";
  let i = 0;
  let inString = false;
  while (i < raw.length) {
    const ch = raw[i]!;
    if (!inString) {
      if (ch === '"') inString = true;
      out += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      let bs = 0;
      for (let j = i - 1; j >= 0 && raw[j] === "\\"; j--) bs++;
      if (bs % 2 === 0) inString = false;
      out += ch;
      i++;
      continue;
    }
    if (ch === "\\") {
      const next = raw[i + 1];
      if (next === undefined) {
        out += ch;
        i++;
        continue;
      }
      if (`"\\/bfnrt`.includes(next)) {
        out += ch + next;
        i += 2;
        continue;
      }
      if (next === "u") {
        const hex = raw.slice(i + 2, i + 6);
        if (/^[0-9a-fA-F]{4}$/.test(hex)) {
          out += raw.slice(i, i + 6);
          i += 6;
          continue;
        }
      }
      i++;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

/** Extract first top-level `{ ... }` using brace depth (respects quoted strings). */
function extractFirstJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i]!;
    if (escaped) {
      escaped = false;
      continue;
    }
    if (inString) {
      if (c === "\\") {
        escaped = true;
        continue;
      }
      if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function parseAnalystJson(content: string): AnalystLLMResponse {
  let jsonText = content.trim();
  const fenced = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) jsonText = fenced[1].trim();

  const candidates = [
    jsonText,
    extractFirstJsonObject(jsonText),
    jsonText.match(/\{[\s\S]*\}/)?.[0],
  ].filter((s): s is string => !!s);

  const variants = (s: string) => [s, repairInvalidJsonEscapes(s)];

  let lastErr: unknown;
  for (const c of candidates) {
    for (const v of variants(c)) {
      try {
        const parsed = JSON.parse(v) as AnalystLLMResponse;
        if (
          typeof parsed.summary === "string" &&
          Array.isArray(parsed.keyTopics) &&
          typeof parsed.sentimentScore === "number" &&
          typeof parsed.relevanceScore === "number"
        ) {
          return {
            summary: parsed.summary,
            keyTopics: parsed.keyTopics,
            sentimentScore: parsed.sentimentScore,
            relevanceScore: parsed.relevanceScore,
            sourceTrustDelta: typeof parsed.sourceTrustDelta === "number" ? parsed.sourceTrustDelta : 0,
            sourceTrustReasoning:
              typeof parsed.sourceTrustReasoning === "string" ? parsed.sourceTrustReasoning : "",
          };
        }
      } catch (e) {
        lastErr = e;
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

function analystModelConfig(modelId: string): ModelConfig {
  if (modelId === MODELS.ANALYST.id) return MODELS.ANALYST;
  if (modelId === TIER_3_BUDGET.id) return TIER_3_BUDGET;
  if (modelId === DEEPSEEK_V3.id) return DEEPSEEK_V3;
  return MODELS.ANALYST;
}

async function main(): Promise<void> {
  const articleId = process.argv.find((a) => a.startsWith("--articleId="))?.split("=")[1];
  if (!articleId) {
    console.error("Missing --articleId");
    process.exit(1);
  }

  if (!(await canSpend("analyst"))) {
    console.error("Budget exceeded or agent paused");
    process.exit(1);
  }

  const db = getOpenClawDb();

  // Idempotency: if summary already exists, return it without re-running LLM
  const existingSummary = await db.summary.findUnique({
    where: { articleId },
    select: { id: true, keyTopics: true, sentimentScore: true, relevanceScore: true, chromaId: true },
  });
  if (existingSummary) {
    console.log(JSON.stringify({
      summaryId: existingSummary.id,
      chromaId: existingSummary.chromaId ?? `summary_${articleId}`,
      keyTopics: existingSummary.keyTopics,
      sentimentScore: existingSummary.sentimentScore ?? 0,
      relevanceScore: existingSummary.relevanceScore ?? 0,
    }));
    await disconnectAll();
    return;
  }

  // 1. Get article
  const article = await db.article.findUniqueOrThrow({
    where: { id: articleId },
    select: { id: true, url: true, title: true, sourceId: true, rawFilePath: true },
  });

  if (!article.rawFilePath) throw new Error(`Article ${articleId} has no rawFilePath`);

  // 2. Mark as analyzing
  await db.article.update({ where: { id: articleId }, data: { status: "ANALYZING" } });

  // 3. Read content
  const rawContent = await readFile(article.rawFilePath, "utf-8");

  // 4. LLM call
  let response;
  try {
    response = await chatCompletion(
      MODELS.ANALYST.id,
      [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Analyze the following article:\n\nTitle: ${article.title}\nURL: ${article.url}\n\n---\n\n${rawContent.slice(0, 12000)}`,
        },
      ],
      {
        temperature: 0.3,
        maxTokens: 1500,
        responseFormat: { type: "json_object" },
        rateLimitFallbackModels: [TIER_3_BUDGET.id, DEEPSEEK_V3.id],
      },
    );
  } catch (err) {
    if (isOpenRouterKeyLimitExceeded(err)) {
      console.error(
        `[analyst-process] OPENROUTER_KEY_LIMIT Key spending cap reached. Raise/remove limit at ${OPENROUTER_KEY_SETTINGS_URL}`,
      );
      await db.article.update({ where: { id: articleId }, data: { status: "SCRAPED" } }).catch(() => {});
      await disconnectAll().catch(() => {});
      process.exit(2);
    }
    if (isOpenRouterRateLimitError(err)) {
      console.error(
        "[analyst-process] OPENROUTER_RATE_LIMIT All analyst models rate limited after retries. Retry later or add provider BYOK: https://openrouter.ai/settings/integrations",
      );
      await db.article.update({ where: { id: articleId }, data: { status: "SCRAPED" } }).catch(() => {});
      await disconnectAll().catch(() => {});
      process.exit(3);
    }
    throw err;
  }

  await logCost(
    "analyst",
    analystModelConfig(response.modelUsed),
    response.promptTokens,
    response.completionTokens,
    response.generationId,
  );

  let analysis: AnalystLLMResponse;
  try {
    analysis = parseAnalystJson(response.content);
  } catch (parseErr) {
    console.error("[analyst] Failed to parse LLM response as JSON:", parseErr);
    console.error("[analyst] Raw response:", response.content.slice(0, 800));
    await db.article.update({ where: { id: articleId }, data: { status: "FAILED" } }).catch(() => {});
    throw new Error(`JSON parse failed: ${parseErr}`);
  }

  // 5. Update source trust
  const source = await db.source.findUniqueOrThrow({
    where: { id: article.sourceId },
    select: { trustScore: true },
  });
  const newTrust = Math.max(0, Math.min(1, source.trustScore + analysis.sourceTrustDelta));
  await db.source.update({ where: { id: article.sourceId }, data: { trustScore: newTrust } });

  // 6. Save summary + embed
  const chromaId = `summary_${articleId}`;
  const summary = await db.summary.create({
    data: {
      articleId,
      content: analysis.summary,
      keyTopics: analysis.keyTopics,
      sentimentScore: analysis.sentimentScore,
      relevanceScore: analysis.relevanceScore,
      chromaId,
    },
  });

  await db.article.update({ where: { id: articleId }, data: { status: "SUMMARIZED", analyzedAt: new Date() } });

  // 7. ChromaDB upsert (optional - continues if embeddings unavailable)
  try {
    const chroma = getChromaClient();
    const collection = await chroma.getCollection({ name: COLLECTIONS.ARTICLE_SUMMARIES });
    await collection.upsert({
      ids: [chromaId],
      documents: [analysis.summary],
      metadatas: [{
        articleId,
        summaryId: summary.id,
        topics: analysis.keyTopics.join(","),
        sentimentScore: analysis.sentimentScore,
        relevanceScore: analysis.relevanceScore,
        createdAt: new Date().toISOString(),
      }],
    });
  } catch (err) {
    console.warn("[analyst] ChromaDB upsert skipped:", (err as Error).message);
  }

  const result = {
    summaryId: summary.id,
    chromaId,
    keyTopics: analysis.keyTopics,
    sentimentScore: analysis.sentimentScore,
    relevanceScore: analysis.relevanceScore,
  };

  console.log(JSON.stringify(result));
  await disconnectAll();
}

main().catch((err) => {
  console.error("[analyst] Fatal:", err);
  process.exit(1);
});
