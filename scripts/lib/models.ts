/**
 * Model Configuration with Tiered Fallback System
 * Budget: 10 CAD/month (~7.30 USD)
 * Strategy: Use cheapest viable models, fallback to free when budget tight
 *
 * Model IDs verified from OpenRouter API (April 2026):
 */

export interface ModelConfig {
  readonly id: string;
  readonly name: string;
  readonly provider: "openrouter";
  readonly tier: 1 | 2 | 3 | 4; // 1=premium, 4=free
  readonly promptCostPer1M: number;
  readonly completionCostPer1M: number;
  readonly contextWindow: number;
  readonly intelligence: "high" | "medium" | "low";
  readonly security: "high" | "medium" | "low";
}

// Kimi K2.6 — primary for prediction/reasoning (best chain-of-thought)
export const KIMI_K2: ModelConfig = {
  id: "moonshotai/kimi-k2.6",
  name: "Kimi K2.6",
  provider: "openrouter",
  tier: 1,
  promptCostPer1M: 0.50,
  completionCostPer1M: 2.50,
  contextWindow: 128000,
  intelligence: "high",
  security: "medium",
};

// DeepSeek V3.2 — fallback for prediction when budget is tight
export const DEEPSEEK_V3: ModelConfig = {
  id: "deepseek/deepseek-v3.2",
  name: "DeepSeek V3.2",
  provider: "openrouter",
  tier: 2,
  promptCostPer1M: 0.28,
  completionCostPer1M: 0.88,
  contextWindow: 65536,
  intelligence: "high",
  security: "medium",
};

// Tier 2: Balanced ($0.10-0.50/1M) — Gemini Flash default for analyst / scout pipelines
export const TIER_2_BALANCED: ModelConfig = {
  id: "google/gemini-2.0-flash-001",
  name: "Gemini 2.0 Flash",
  provider: "openrouter",
  tier: 2,
  promptCostPer1M: 0.10,
  completionCostPer1M: 0.40,
  contextWindow: 1000000,
  intelligence: "high",
  security: "high",
};

// Tier 3: Budget ($0.05-0.10/1M) - GPT Mini
export const TIER_3_BUDGET: ModelConfig = {
  id: "openai/gpt-4o-mini",
  name: "GPT-4o Mini",
  provider: "openrouter",
  tier: 3,
  promptCostPer1M: 0.15,
  completionCostPer1M: 0.60,
  contextWindow: 128000,
  intelligence: "medium",
  security: "high",
};

// Tier 4: Free/OSS ($0) - Llama 3
const TIER_4_FREE: ModelConfig = {
  id: "meta-llama/llama-3-8b-instruct",
  name: "Llama 3 8B",
  provider: "openrouter",
  tier: 4,
  promptCostPer1M: 0,
  completionCostPer1M: 0,
  contextWindow: 8192,
  intelligence: "medium",
  security: "medium",
};

// Model selection by budget tier
export const MODELS_BY_TIER = {
  1: { ANALYST: TIER_2_BALANCED, PREDICTION: KIMI_K2, SUMMARIZER: TIER_2_BALANCED },
  2: { ANALYST: TIER_2_BALANCED, PREDICTION: DEEPSEEK_V3, SUMMARIZER: TIER_2_BALANCED },
  3: { ANALYST: TIER_3_BUDGET, PREDICTION: TIER_3_BUDGET, SUMMARIZER: TIER_3_BUDGET },
  4: { ANALYST: TIER_4_FREE, PREDICTION: TIER_4_FREE, SUMMARIZER: TIER_4_FREE },
} as const;

// Default exports — kimi-k2.6 is primary for predictions/reasoning; analyst uses cheap high-IQ Flash
export const MODELS = {
  ANALYST: TIER_2_BALANCED,
  PREDICTION: KIMI_K2,
  // SUMMARIZER always starts from Gemini Flash — never a reasoning model
  SUMMARIZER: TIER_2_BALANCED,
  FEEDBACK: TIER_3_BUDGET,
  MANAGER: TIER_3_BUDGET,
};

// Budget thresholds for tier selection (USD)
const BUDGET_THRESHOLDS = {
  daily: parseFloat(process.env["DAILY_BUDGET_USD"] ?? "0.24"),
  monthly: parseFloat(process.env["MONTHLY_BUDGET_USD"] ?? "7.30"),
};

// Calculate spend percentage and return appropriate tier
export async function getBudgetTier(
  getMonthlySpend: () => Promise<number>,
): Promise<1 | 2 | 3 | 4> {
  const monthlySpend = await getMonthlySpend();
  const dailySpend = monthlySpend / 30; // Rough daily average
  const monthlyPercent = monthlySpend / BUDGET_THRESHOLDS.monthly;
  const daysInMonth = new Date().getDate();
  const projectedMonthly = (monthlySpend / daysInMonth) * 30;

  // Emergency: Over 90% monthly or projected over budget
  if (monthlyPercent > 0.9 || projectedMonthly > BUDGET_THRESHOLDS.monthly * 0.95) {
    console.log(`[budget] Emergency tier 4 (free models): ${(monthlyPercent * 100).toFixed(1)}% spent`);
    return 4;
  }

  // Caution: Over 70% monthly or daily average exceeded
  if (monthlyPercent > 0.7 || dailySpend > BUDGET_THRESHOLDS.daily * 1.5) {
    console.log(`[budget] Tier 3 (budget models): ${(monthlyPercent * 100).toFixed(1)}% spent`);
    return 3;
  }

  // Normal: Over 40% monthly
  if (monthlyPercent > 0.4) {
    console.log(`[budget] Tier 2 (balanced): ${(monthlyPercent * 100).toFixed(1)}% spent`);
    return 2;
  }

  // Healthy budget
  console.log(`[budget] Tier 1 (premium): ${(monthlyPercent * 100).toFixed(1)}% spent`);
  return 1;
}

// Get models for current budget situation
export async function getModelsForCurrentBudget(
  getMonthlySpend: () => Promise<number>,
): Promise<{ ANALYST: ModelConfig; PREDICTION: ModelConfig; SUMMARIZER: ModelConfig }> {
  const tier = await getBudgetTier(getMonthlySpend);
  return MODELS_BY_TIER[tier];
}

export function estimateCost(
  model: ModelConfig,
  promptTokens: number,
  completionTokens: number,
): number {
  return (
    (promptTokens / 1_000_000) * model.promptCostPer1M +
    (completionTokens / 1_000_000) * model.completionCostPer1M
  );
}

// Estimate if a call is affordable given remaining budget
export function canAfford(
  model: ModelConfig,
  promptTokens: number,
  completionTokensEst: number,
  remainingBudget: number,
): boolean {
  const estimated = estimateCost(model, promptTokens, completionTokensEst);
  return estimated <= remainingBudget;
}
