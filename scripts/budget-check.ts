#!/usr/bin/env tsx
/**
 * budget-check.ts — Budget status report.
 *
 * Usage: npx tsx scripts/budget-check.ts
 *
 * Outputs JSON with monthly spend, limit, per-agent breakdown, OpenRouter usage.
 */
import "dotenv/config";
import { getBudgetStatus } from "./lib/budget.js";
import { disconnectAll } from "./lib/prisma.js";

async function main(): Promise<void> {
  const status = await getBudgetStatus();
  console.log(JSON.stringify(status, null, 2));
  await disconnectAll();
}

main().catch((err) => {
  console.error("[budget] Fatal:", err);
  process.exit(1);
});
