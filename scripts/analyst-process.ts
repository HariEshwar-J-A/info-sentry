#!/usr/bin/env tsx
/**
 * analyst-process.ts — Analyze a single article via LLM.
 *
 * Usage: npx tsx scripts/analyst-process.ts --articleId=abc123
 *
 * Reads article content, calls DeepSeek V3.2, saves summary + embeds in ChromaDB.
 * Outputs JSON: { summaryId, chromaId, keyTopics, sentimentScore, relevanceScore }
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { getOpenClawDb, disconnectAll } from "./lib/prisma.js";
import { getChromaClient, COLLECTIONS } from "./lib/chromadb.js";
import { MODELS } from "./lib/models.js";
import { chatCompletion } from "./lib/openrouter.js";
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
  "summary": "A concise 2-4 paragraph summary of the article's key information. Focus on facts, claims, and implications. Write in clear, direct language without editorializing.",
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

Respond ONLY with the JSON object. No markdown code fences. No extra text.`;

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
  const response = await chatCompletion(
    MODELS.ANALYST.id,
    [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Analyze the following article:\n\nTitle: ${article.title}\nURL: ${article.url}\n\n---\n\n${rawContent.slice(0, 12000)}`,
      },
    ],
    { temperature: 0.3, maxTokens: 1500, responseFormat: { type: "json_object" } },
  );

  await logCost("analyst", MODELS.ANALYST, response.promptTokens, response.completionTokens, response.generationId);

  const analysis: AnalystLLMResponse = JSON.parse(response.content);

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

  // 7. ChromaDB upsert
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
