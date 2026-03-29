import { getOpenClawDb } from "./prisma.js";
import { estimateCost, type ModelConfig } from "./models.js";
import { getKeyInfo } from "./openrouter.js";

const MONTHLY_BUDGET_USD = parseFloat(process.env["MONTHLY_BUDGET_USD"] ?? "14.5");

/** Log a completed LLM call's cost to the CostLog table */
export async function logCost(
  agentName: string,
  model: ModelConfig,
  promptTokens: number,
  completionTokens: number,
  openrouterGenId?: string,
): Promise<void> {
  const cost = estimateCost(model, promptTokens, completionTokens);
  const db = getOpenClawDb();

  await db.costLog.create({
    data: {
      agentName,
      modelId: model.id,
      promptTokens,
      completionTokens,
      totalCostUsd: cost,
      openrouterGenId,
    },
  });
}

/** Get total spend this calendar month from local CostLog table */
export async function getMonthlySpend(): Promise<number> {
  const db = getOpenClawDb();
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const result = await db.costLog.aggregate({
    _sum: { totalCostUsd: true },
    where: { createdAt: { gte: startOfMonth } },
  });

  return result._sum.totalCostUsd ?? 0;
}

/** Get spend broken down by agent for this month */
export async function getSpendByAgent(): Promise<Record<string, number>> {
  const db = getOpenClawDb();
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const results = await db.costLog.groupBy({
    by: ["agentName"],
    _sum: { totalCostUsd: true },
    where: { createdAt: { gte: startOfMonth } },
  });

  const breakdown: Record<string, number> = {};
  for (const r of results) {
    breakdown[r.agentName] = r._sum.totalCostUsd ?? 0;
  }
  return breakdown;
}

/** Cross-reference with OpenRouter's own usage data */
export async function getOpenRouterUsage(): Promise<number> {
  const info = await getKeyInfo();
  return info.usage;
}

/** Check if budget allows another LLM call. Returns false if exceeded. */
export async function canSpend(agentName: string): Promise<boolean> {
  const spend = await getMonthlySpend();
  if (spend >= MONTHLY_BUDGET_USD) {
    console.error(`[budget] Budget exceeded ($${spend.toFixed(4)} / $${MONTHLY_BUDGET_USD}), blocking ${agentName}`);
    return false;
  }

  const db = getOpenClawDb();
  const agentConfig = await db.agentConfig.findUnique({
    where: { agentName },
  });

  if (agentConfig && !agentConfig.isActive) {
    console.log(`[budget] Agent ${agentName} is paused, blocking LLM call`);
    return false;
  }

  return true;
}

/** Get full budget status report */
export async function getBudgetStatus(): Promise<{
  monthlySpendUsd: number;
  budgetLimitUsd: number;
  percentUsed: number;
  spendByAgent: Record<string, number>;
  openRouterUsage: number | null;
}> {
  const monthlySpend = await getMonthlySpend();
  const spendByAgent = await getSpendByAgent();

  let openRouterUsage: number | null = null;
  try {
    openRouterUsage = await getOpenRouterUsage();
  } catch {
    // OpenRouter API may be unreachable
  }

  return {
    monthlySpendUsd: monthlySpend,
    budgetLimitUsd: MONTHLY_BUDGET_USD,
    percentUsed: monthlySpend / MONTHLY_BUDGET_USD,
    spendByAgent,
    openRouterUsage,
  };
}
