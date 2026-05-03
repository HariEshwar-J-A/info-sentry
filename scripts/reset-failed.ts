import { getOpenClawDb, disconnectAll } from "./lib/prisma.js";

async function main() {
  const db = getOpenClawDb();

  // Reset FAILED → SCRAPED
  const failed = await db.article.updateMany({
    where: { status: "FAILED" },
    data: { status: "SCRAPED" },
  });

  // Reset stuck ANALYZING → SCRAPED (interrupted mid-analyst)
  const stuck = await db.article.updateMany({
    where: { status: "ANALYZING" },
    data: { status: "SCRAPED" },
  });

  console.log(`Reset ${failed.count} FAILED + ${stuck.count} stuck ANALYZING articles to SCRAPED`);
  await disconnectAll();
}

main();
