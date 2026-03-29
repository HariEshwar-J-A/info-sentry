#!/usr/bin/env tsx
/**
 * health-check.ts — System health report.
 *
 * Usage: npx tsx scripts/health-check.ts
 *
 * Outputs JSON with agent statuses, article/summary/prediction counts, DB status.
 */
import "dotenv/config";
import { getOpenClawDb, disconnectAll } from "./lib/prisma.js";

async function main(): Promise<void> {
  const db = getOpenClawDb();

  const [agentConfigs, articleCount, summaryCount, predictionCount, pendingCount] =
    await Promise.all([
      db.agentConfig.findMany({
        select: { agentName: true, isActive: true, lastRunAt: true, lastError: true },
      }),
      db.article.count(),
      db.summary.count(),
      db.prediction.count(),
      db.article.count({ where: { status: "SCRAPED" } }),
    ]);

  const health = {
    agents: agentConfigs.map((c) => ({
      name: c.agentName,
      isActive: c.isActive,
      lastRunAt: c.lastRunAt,
      lastError: c.lastError,
    })),
    counts: {
      articles: articleCount,
      summaries: summaryCount,
      predictions: predictionCount,
      pendingArticles: pendingCount,
    },
    database: { connected: true },
  };

  console.log(JSON.stringify(health, null, 2));
  await disconnectAll();
}

main().catch((err) => {
  console.error("[health] Fatal:", err);
  process.exit(1);
});
