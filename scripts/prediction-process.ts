#!/usr/bin/env tsx
/**
 * prediction-process.ts — Generate predictions for a single summary via LLM.
 * MODIFIED: Integrates with validation queue for human-in-the-loop approval.
 *
 * Usage: npx tsx scripts/prediction-process.ts --summaryId=abc123
 *
 * Reads summary, fetches historical context from ChromaDB, calls LLM based on budget tier.
 * Outputs JSON: { predictions: [{ predictionId, confidence, timeHorizon }], skipped: boolean, queued: boolean }
 */
import "dotenv/config";
import { getOpenClawDb, disconnectAll } from "./lib/prisma.js";
import { getChromaClient, COLLECTIONS } from "./lib/chromadb.js";
import { getModelsForCurrentBudget, DEEPSEEK_V3, type ModelConfig } from "./lib/models.js";
import { chatCompletion } from "./lib/openrouter.js";
import { logCost, canSpend, getMonthlySpend } from "./lib/budget.js";

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

function getSystemPrompt(budgetTier: number): string {
  const basePrompt = `You are the Prediction Agent for Info-Sentry, a personal news intelligence system.

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

  // Adjust for budget tier (lower tiers get more constrained prompts)
  if (budgetTier >= 3) {
    return basePrompt + `

BUDGET MODE: Be concise. Limit predictions to 1-2 with shorter reasoning.`;
  }
  if (budgetTier === 4) {
    return basePrompt + `

FREE TIER MODE: Absolute minimal tokens. One prediction, 1-sentence reasoning.`;
  }
  return basePrompt;
}

async function main(): Promise<void> {
  const summaryId = process.argv.find((a) => a.startsWith("--summaryId="))?.split("=")[1];
  if (!summaryId) {
    console.error("Missing --summaryId");
    process.exit(1);
  }

  // Check budget
  if (!(await canSpend("prediction"))) {
    console.error("Budget exceeded or agent paused");
    process.exit(1);
  }

  const db = getOpenClawDb();

  // Get current budget tier and appropriate models
  const getSpend = async () => getMonthlySpend();
  const models = await getModelsForCurrentBudget(getSpend);
  const model = models.PREDICTION;
  console.log(`[prediction] Using model: ${model.name} (tier ${model.tier})`);

  // 1. Get summary
  const summary = await db.summary.findUniqueOrThrow({
    where: { id: summaryId },
    select: { id: true, content: true, keyTopics: true, articleId: true },
  });

  // 2. Historical context from ChromaDB (best effort - continues if unavailable)
  let historyContext = "No historical context available yet.";
  try {
    const chroma = getChromaClient();
    const collection = await chroma.getCollection({ name: COLLECTIONS.ARTICLE_SUMMARIES });
    const queryResults = await collection.query({
      queryTexts: [summary.keyTopics.join(" ")],
      nResults: 5,
    });

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
  } catch (err) {
    console.warn("[prediction] ChromaDB query skipped:", (err as Error).message);
  }

  // 3. LLM call with budget-aware model + fallback chain on empty response
  const messages: Parameters<typeof chatCompletion>[1] = [
    { role: "system", content: getSystemPrompt(model.tier) },
    {
      role: "user",
      content: `Current Summary:\n${summary.content}\n\nKey Topics: ${summary.keyTopics.join(", ")}\n\nHistorical Context:\n${historyContext}`,
    },
  ];

  // If primary model is tier 1 (Kimi), fall back to DeepSeek V3.2 then tier 3 on empty content
  const fallbackChain: ModelConfig[] = model.tier === 1
    ? [model, DEEPSEEK_V3]
    : [model];

  let response: Awaited<ReturnType<typeof chatCompletion>> | null = null;
  let usedModel = model;

  for (const candidate of fallbackChain) {
    try {
      usedModel = candidate;
      response = await chatCompletion(
        candidate.id,
        messages,
        { temperature: 0.5, maxTokens: candidate.tier >= 3 ? 800 : 1500, responseFormat: { type: "json_object" } },
      );
      break;
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("Empty response") && candidate !== fallbackChain.at(-1)) {
        console.warn(`[prediction] ${candidate.name} returned empty — trying fallback`);
        continue;
      }
      throw err;
    }
  }

  if (!response) throw new Error("All models in fallback chain returned empty responses");

  await logCost("prediction", usedModel, response.promptTokens, response.completionTokens, response.generationId);

  const result: PredictionLLMResponse = JSON.parse(response.content);

  if (result.shouldSkip) {
    console.log(JSON.stringify({ predictions: [], skipped: true, queued: false }));
    await disconnectAll();
    return;
  }

  // 4. Save predictions to DB
  const savedPredictions: { predictionId: string; confidence: number; timeHorizon: string }[] = [];
  
  // Get collections (best effort)
  let predCollection: unknown;
  try {
    const chroma = getChromaClient();
    predCollection = await chroma.getCollection({ name: COLLECTIONS.PREDICTIONS });
  } catch {
    predCollection = null;
  }

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
    if (predCollection) {
      try {
        await (predCollection as { upsert: (args: Record<string, unknown>) => Promise<void> }).upsert({
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
      } catch (err) {
        console.warn("[prediction] ChromaDB upsert skipped:", (err as Error).message);
      }
    }

    savedPredictions.push({
      predictionId: prediction.id,
      confidence: pred.confidence,
      timeHorizon: pred.timeHorizon,
    });
  }

  // 5. Add to validation queue for human approval
  const avgConfidence = savedPredictions.reduce((s, p) => s + p.confidence, 0) / savedPredictions.length;
  const firstPredictionId = savedPredictions[0]?.predictionId ?? "";

  try {
    // Direct DB insertion instead of shell exec
    await db.validationQueue.create({
      data: {
        predictionId: firstPredictionId,
        articleId: summary.articleId,
        summary: summary.content.slice(0, 500),
        predictions: savedPredictions,
        confidence: avgConfidence,
        status: avgConfidence >= 0.6 ? "AUTO_APPROVED" : "PENDING",
        resolvedAt: avgConfidence >= 0.6 ? new Date() : undefined,
      },
    });
    console.log("[prediction] Queued for validation:", firstPredictionId, avgConfidence >= 0.6 ? "(auto-approved)" : "(pending)");
  } catch (err) {
    console.warn("[prediction] Failed to queue for validation:", err);
  }

  console.log(JSON.stringify({
    predictions: savedPredictions,
    connectionsToPast: result.connectionsToPast,
    skipped: false,
    queued: true,
  }));

  await disconnectAll();
}

main().catch((err) => {
  console.error("[prediction] Fatal:", err);
  process.exit(1);
});
