import "dotenv/config";
import { getOpenClawDb, disconnectAll } from "./lib/prisma.js";

async function main() {
  const db = getOpenClawDb();
  
  console.log("=== Info Sentry Sources ===\n");
  
  const sources = await db.source.findMany({
    where: { isActive: true },
    include: { interests: true },
    orderBy: { name: "asc" }
  });
  
  console.log(`Found ${sources.length} active sources:\n`);
  
  for (const source of sources) {
    console.log(`📰 ${source.name}`);
    console.log(`   URL: ${source.url}`);
    console.log(`   Type: ${source.type}, Method: ${source.crawlMethod}`);
    console.log(`   RSS: ${source.rssUrl || "none"}`);
    console.log();
  }
  
  // Also check article counts
  console.log("\n=== Article Statistics ===");
  const articles = await db.article.findMany({
    orderBy: { scrapedAt: "desc" },
    take: 5,
    include: { source: { select: { name: true } } }
  });
  
  const counts = await db.article.groupBy({
    by: ["status"],
    _count: { status: true }
  });
  
  console.log("\nStatus breakdown:");
  for (const { status, _count } of counts) {
    console.log(`  ${status}: ${_count.status}`);
  }
  
  console.log("\nRecent articles:");
  for (const art of articles) {
    console.log(`  [${art.status}] ${art.title?.slice(0, 60) || "Untitled"} (${art.source?.name})`);
  }
  
  await disconnectAll();
}

main().catch(e => { console.error(e); process.exit(1); });
