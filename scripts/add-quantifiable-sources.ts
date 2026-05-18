#!/usr/bin/env tsx
/**
 * Add reliable quantifiable sources for AI agents and trends analysis
 */
import "dotenv/config";
import { getOpenClawDb, disconnectAll } from "./lib/prisma.js";

const QUANTIFIABLE_SOURCES = [
  { 
    name: "CB Insights AI", 
    url: "https://www.cbinsights.com/research/artificial-intelligence/", 
    type: "WEB" as const, 
    crawlMethod: "CHEERIO" as const, 
    trustScore: 0.95 
  },
  { 
    name: "Crunchbase AI Funding", 
    url: "https://news.crunchbase.com/artificial-intelligence/", 
    type: "WEB" as const, 
    crawlMethod: "CHEERIO" as const, 
    trustScore: 0.95 
  },
  { 
    name: "Stanford HAI AI Index", 
    url: "https://hai.stanford.edu/ai-index-report", 
    type: "WEB" as const, 
    crawlMethod: "CHEERIO" as const, 
    trustScore: 0.98 
  },
  { 
    name: "Epoch AI Trends", 
    url: "https://epoch.ai/trends", 
    type: "WEB" as const, 
    crawlMethod: "CHEERIO" as const, 
    trustScore: 0.95 
  },
  { 
    name: "McKinsey AI Report", 
    url: "https://www.mckinsey.com/capabilities/quantumblack/our-insights", 
    type: "WEB" as const, 
    crawlMethod: "CHEERIO" as const, 
    trustScore: 0.90 
  },
  { 
    name: "Bloomberg AI", 
    url: "https://www.bloomberg.com/technology/artificial-intelligence", 
    type: "WEB" as const, 
    crawlMethod: "PLAYWRIGHT" as const, 
    trustScore: 0.95 
  },
  { 
    name: "Reuters AI", 
    url: "https://www.reuters.com/technology/artificial-intelligence/", 
    type: "WEB" as const, 
    crawlMethod: "CHEERIO" as const, 
    trustScore: 0.95 
  },
  { 
    name: "AI Infrastructure Report", 
    url: "https://a16z.com/ai/", 
    type: "WEB" as const, 
    crawlMethod: "CHEERIO" as const, 
    trustScore: 0.88 
  },
];

async function main() {
  const db = getOpenClawDb();
  const interestId = process.argv[2];
  
  if (!interestId) {
    console.error("Usage: npx tsx scripts/add-quantifiable-sources.ts <interestId>");
    process.exit(1);
  }

  console.log(`[setup] Adding ${QUANTIFIABLE_SOURCES.length} quantifiable sources for interest: ${interestId}\n`);

  for (const src of QUANTIFIABLE_SOURCES) {
    const source = await db.source.upsert({
      where: { url: src.url },
      update: { trustScore: src.trustScore },
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

    console.log(`✅ ${src.name} (${src.trustScore * 100}% trust) → ${src.crawlMethod}`);
  }

  console.log(`\n[setup] Done! Total quantifiable sources: ${QUANTIFIABLE_SOURCES.length}`);
  await disconnectAll();
}

main().catch((err) => {
  console.error("[setup] Error:", err);
  process.exit(1);
});
