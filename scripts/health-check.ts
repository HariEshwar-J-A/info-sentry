#!/usr/bin/env tsx
/**
 * health-check.ts — System health report.
 *
 * Usage: npx tsx scripts/health-check.ts
 *
 * Outputs JSON with agent statuses, article/summary/prediction counts, DB status,
 * and Scout v3 ScrapeGraph sidecar reachability.
 *
 * When INFO_SENTRY_USER_ID is set (web Settings runs), counts reflect only that user's feeds/topics.
 */
import "dotenv/config";
import { getOpenClawDb, disconnectAll } from "./lib/prisma.js";
import { articleWhereScoped, pipelineUserIdFromEnv } from "./lib/pipeline-scope.js";
import { getQueryExpandModel, getSgaiModelHint } from "./lib/scout-llm-defaults.js";

async function probeScrapegraph(): Promise<{ ok: boolean; url: string }> {
  const base = (process.env["SCRAPEGRAPH_URL"] ?? "http://127.0.0.1:8811").replace(/\/$/, "");
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch(`${base}/health`, { signal: ctrl.signal });
    clearTimeout(t);
    return { ok: res.ok, url: base };
  } catch {
    return { ok: false, url: base };
  }
}

async function main(): Promise<void> {
  const db = getOpenClawDb();

  const pipelineUserId = pipelineUserIdFromEnv();
  const articleScope = pipelineUserId ? articleWhereScoped({ userId: pipelineUserId }) : undefined;
  if (pipelineUserId) {
    console.error(`[health] Web scope: counts for user ${pipelineUserId}`);
  }

  const [agentConfigs, articleCount, summaryCount, predictionCount, pendingCount, scrapegraph] =
    await Promise.all([
      db.agentConfig.findMany({
        select: { agentName: true, isActive: true, lastRunAt: true, lastError: true },
      }),
      db.article.count(articleScope ? { where: articleScope } : undefined),
      db.summary.count(
        articleScope
          ? {
              where: {
                article: articleScope,
              },
            }
          : undefined,
      ),
      db.prediction.count(
        articleScope
          ? {
              where: {
                article: articleScope,
              },
            }
          : undefined,
      ),
      db.article.count(
        articleScope
          ? { where: { status: "SCRAPED", ...articleScope } }
          : { where: { status: "SCRAPED" } },
      ),
      probeScrapegraph(),
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
    scrapegraph: {
      ok: scrapegraph.ok,
      baseUrl: scrapegraph.url,
      models: {
        queryExpand: getQueryExpandModel(),
        sgai: getSgaiModelHint(),
      },
    },
  };

  console.log(JSON.stringify(health, null, 2));
  await disconnectAll();
}

main().catch((err) => {
  console.error("[health] Fatal:", err);
  process.exit(1);
});
