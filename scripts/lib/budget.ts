import { getOpenClawDb } from "./prisma.js";
import { estimateCost, type ModelConfig } from "./models.js";
import { getKeyInfo } from "./openrouter.js";

// 10 CAD/month ≈ 7.30 USD/month
const MONTHLY_BUDGET_USD = parseFloat(process.env["MONTHLY_BUDGET_USD"] ?? "7.30");
const DAILY_BUDGET_USD = parseFloat(process.env["DAILY_BUDGET_USD"] ?? "0.24");

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

/** Get today's spend */
export async function getTodaySpend(): Promise<number> {
  const db = getOpenClawDb();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const result = await db.costLog.aggregate({
    _sum: { totalCostUsd: true },
    where: { createdAt: { gte: today } },
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
  const [monthlySpend, todaySpend] = await Promise.all([
    getMonthlySpend(),
    getTodaySpend(),
  ]);

  // Hard stop on monthly budget
  if (monthlySpend >= MONTHLY_BUDGET_USD) {
    console.error(`[budget] MONTHLY BUDGET EXHAUSTED ($${monthlySpend.toFixed(4)} / $${MONTHLY_BUDGET_USD}), blocking ${agentName}`);
    return false;
  }

  // Warning on daily budget (soft limit - allows bursts but warns)
  if (todaySpend >= DAILY_BUDGET_USD) {
    console.warn(`[budget] Daily budget exceeded ($${todaySpend.toFixed(4)} / $${DAILY_BUDGET_USD}), proceeding with caution`);
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

/** Get remaining budget in USD */
export async function getRemainingBudget(): Promise<number> {
  const spent = await getMonthlySpend();
  return Math.max(0, MONTHLY_BUDGET_USD - spent);
}

/** Get full budget status report */
export async function getBudgetStatus(): Promise<{
  monthlySpendUsd: number;
  todaySpendUsd: number;
  budgetLimitUsd: number;
  dailyBudgetUsd: number;
  percentUsed: number;
  percentUsedToday: number;
  remainingUsd: number;
  spendByAgent: Record<string, number>;
  openRouterUsage: number | null;
  projectedMonthlySpend: number;
}> {
  const [monthlySpend, todaySpend, spendByAgent] = await Promise.all([
    getMonthlySpend(),
    getTodaySpend(),
    getSpendByAgent(),
  ]);

  let openRouterUsage: number | null = null;
  try {
    openRouterUsage = await getOpenRouterUsage();
  } catch {
    // OpenRouter API may be unreachable
  }

  // Project monthly spend based on current rate
  const dayOfMonth = new Date().getDate();
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const projectedMonthlySpend = (monthlySpend / dayOfMonth) * daysInMonth;

  return {
    monthlySpendUsd: monthlySpend,
    todaySpendUsd: todaySpend,
    budgetLimitUsd: MONTHLY_BUDGET_USD,
    dailyBudgetUsd: DAILY_BUDGET_USD,
    percentUsed: monthlySpend / MONTHLY_BUDGET_USD,
    percentUsedToday: todaySpend / DAILY_BUDGET_USD,
    remainingUsd: Math.max(0, MONTHLY_BUDGET_USD - monthlySpend),
    spendByAgent,
    openRouterUsage,
    projectedMonthlySpend,
  };
}

/** Format budget for display */
export function formatBudgetStatus(status: Awaited<ReturnType<typeof getBudgetStatus>>): string {
  const cadRate = 1.37;
  const toCad = (usd: number) => usd * cadRate;

  const tierEmoji = status.percentUsed > 0.9 ? "🔴" : status.percentUsed > 0.7 ? "🟡" : "🟢";

  return [
    `${tierEmoji} Budget Status`,
    `Monthly: $${toCad(status.monthlySpendUsd).toFixed(2)} / $${toCad(status.budgetLimitUsd).toFixed(2)} CAD (${(status.percentUsed * 100).toFixed(1)}%)`,
    `Today: $${toCad(status.todaySpendUsd).toFixed(2)} / $${toCad(status.dailyBudgetUsd).toFixed(2)} CAD`,
    `Remaining: $${toCad(status.remainingUsd).toFixed(2)} CAD`,
    `Projected: $${toCad(status.projectedMonthlySpend).toFixed(2)} CAD`,
  ].join("\n");
}
