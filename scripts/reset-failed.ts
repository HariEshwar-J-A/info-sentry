import { getOpenClawDb, disconnectAll } from "./lib/prisma.js";

async function main() {
  const db = getOpenClawDb();
  const result = await db.article.updateMany({
    where: { status: "FAILED" },
    data: { status: "SCRAPED" }
  });
  console.log(`Reset ${result.count} failed articles to SCRAPED`);
  await disconnectAll();
}

main();
