#!/usr/bin/env tsx
/**
 * setup-sources.ts — Add sources and link to interest
 */
import "dotenv/config";
import { getOpenClawDb, disconnectAll } from "./lib/prisma.js";

const AI_SOURCES = [
  { name: "TechCrunch AI", url: "https://techcrunch.com/category/artificial-intelligence/", type: "WEB" as const, crawlMethod: "CHEERIO" as const, trustScore: 0.8 },
  { name: "The Verge AI", url: "https://www.theverge.com/ai-artificial-intelligence", type: "WEB" as const, crawlMethod: "CHEERIO" as const, trustScore: 0.8 },
  { name: "MIT Technology Review AI", url: "https://www.technologyreview.com/topic/artificial-intelligence/", type: "WEB" as const, crawlMethod: "CHEERIO" as const, trustScore: 0.9 },
];

async function main() {
  const db = getOpenClawDb();
  const interestId = process.argv[2];
  
  if (!interestId) {
    console.error("Usage: npx tsx scripts/setup-sources.ts <interestId>");
    process.exit(1);
  }

  console.log(`[setup] Adding sources for interest: ${interestId}`);

  for (const src of AI_SOURCES) {
    const source = await db.source.upsert({
      where: { url: src.url },
      update: {},
      create: {
        name: src.name,
        url: src.url,
        type: src.type,
        crawlMethod: src.crawlMethod,
        trustScore: src.trustScore,
        isActive: true,
      },
    });

    await db.interestSource.upsert({
      where: {
        interestId_sourceId: { interestId, sourceId: source.id }
      },
      update: {},
      create: {
        interestId,
        sourceId: source.id,
      },
    });

    console.log(`[setup] Linked ${src.name} → interest`);
  }

  console.log("[setup] Done! Run scout again to scrape.");
  await disconnectAll();
}

main().catch((err) => {
  console.error("[setup] Error:", err);
  process.exit(1);
});
