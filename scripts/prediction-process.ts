#!/usr/bin/env tsx
/**
 * prediction-process.ts — Generate predictions for a single summary via LLM.
 *
 * Usage: npx tsx scripts/prediction-process.ts --summaryId=abc123
 *
 * Reads summary, fetches historical context from ChromaDB, calls DeepSeek V3.2.
 * Outputs JSON: { predictions: [{ predictionId, confidence, timeHorizon }], skipped: boolean }
 */
import "dotenv/config";
import { getOpenClawDb, disconnectAll } from "./lib/prisma.js";
import { getChromaClient, COLLECTIONS } from "./lib/chromadb.js";
import { MODELS } from "./lib/models.js";
import { chatCompletion } from "./lib/openrouter.js";
import { logCost, canSpend } from "./lib/budget.js";

interface PredictionEntry {
  content: string;
  confidence: number;
  timeHorizon: string;
  reasoning: string;
}

interface PredictionLLMResponse {
  predictions: PredictionEntry[];
  connectionsToPast: string;
  shouldSkip: boolean;
}

const SYSTEM_PROMPT = `You are the Prediction Agent for Info-Sentry, a personal news intelligence system.

Your role is to analyze news summaries alongside historical context and generate forward-looking predictions.

You will receive:
1. A current article summary with its key topics and sentiment
2. Historical context: similar past articles/summaries from the knowledge base

Return a JSON object:
{
  "predictions": [
    {
      "content": "A specific, falsifiable prediction.",
      "confidence": 0.0,
      "timeHorizon": "1 week",
      "reasoning": "2-3 sentences explaining reasoning."
    }
  ],
  "connectionsToPast": "How this relates to past events.",
  "shouldSkip": false
}

Guidelines:
1. Generate 1-3 predictions per article.
2. Predictions must be concrete enough to verify later.
3. Confidence: 0.1-0.3 speculative, 0.4-0.6 moderate, 0.7-0.9 high. Never 0.0 or 1.0.
4. Time horizons: be realistic. Tech adoption = months-years, policy = weeks-months, markets = days-weeks.
5. Set shouldSkip=true only for routine press releases with no predictive signal.

Respond ONLY with the JSON object. No markdown code fences.`;

async function main(): Promise<void> {
  const summaryId = process.argv.find((a) => a.startsWith("--summaryId="))?.split("=")[1];
  if (!summaryId) {
    console.error("Missing --summaryId");
    process.exit(1);
  }

  if (!(await canSpend("prediction"))) {
    console.error("Budget exceeded or agent paused");
    process.exit(1);
  }

  const db = getOpenClawDb();

  // 1. Get summary
  const summary = await db.summary.findUniqueOrThrow({
    where: { id: summaryId },
    select: { id: true, content: true, keyTopics: true, articleId: true },
  });

  // 2. Historical context from ChromaDB
  const chroma = getChromaClient();
  const collection = await chroma.getCollection({ name: COLLECTIONS.ARTICLE_SUMMARIES });
  const queryResults = await collection.query({
    queryTexts: [summary.keyTopics.join(" ")],
    nResults: 5,
  });

  let historyContext = "No historical context available yet.";
  if (queryResults.ids[0] && queryResults.ids[0].length > 0) {
    const items: string[] = [];
    for (let i = 0; i < queryResults.ids[0].length; i++) {
      const doc = queryResults.documents[0]?.[i];
      const meta = queryResults.metadatas[0]?.[i] as Record<string, unknown> | undefined;
      if (doc) {
        items.push(`[Past Article ${i + 1}] (${(meta?.["createdAt"] as string) ?? "unknown"}):\n${doc}`);
      }
    }
    if (items.length > 0) historyContext = items.join("\n\n");
  }

  // 3. LLM call
  const response = await chatCompletion(
    MODELS.PREDICTION.id,
    [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Current Summary:\n${summary.content}\n\nKey Topics: ${summary.keyTopics.join(", ")}\n\nHistorical Context:\n${historyContext}`,
      },
    ],
    { temperature: 0.5, maxTokens: 1500, responseFormat: { type: "json_object" } },
  );

  await logCost("prediction", MODELS.PREDICTION, response.promptTokens, response.completionTokens, response.generationId);

  const result: PredictionLLMResponse = JSON.parse(response.content);

  if (result.shouldSkip) {
    console.log(JSON.stringify({ predictions: [], skipped: true }));
    await disconnectAll();
    return;
  }

  // 4. Save predictions + embed
  const predCollection = await chroma.getCollection({ name: COLLECTIONS.PREDICTIONS });
  const savedPredictions: { predictionId: string; confidence: number; timeHorizon: string }[] = [];

  for (const pred of result.predictions) {
    const prediction = await db.prediction.create({
      data: {
        articleId: summary.articleId,
        content: pred.content,
        confidence: Math.max(0.01, Math.min(0.99, pred.confidence)),
        timeHorizon: pred.timeHorizon,
        status: "PENDING",
      },
    });

    const chromaId = `prediction_${prediction.id}`;
    await predCollection.upsert({
      ids: [chromaId],
      documents: [pred.content],
      metadatas: [{
        predictionId: prediction.id,
        articleId: summary.articleId,
        confidence: pred.confidence,
        timeHorizon: pred.timeHorizon,
        createdAt: new Date().toISOString(),
      }],
    });

    savedPredictions.push({
      predictionId: prediction.id,
      confidence: pred.confidence,
      timeHorizon: pred.timeHorizon,
    });
  }

  console.log(JSON.stringify({
    predictions: savedPredictions,
    connectionsToPast: result.connectionsToPast,
    skipped: false,
  }));

  await disconnectAll();
}

main().catch((err) => {
  console.error("[prediction] Fatal:", err);
  process.exit(1);
});
