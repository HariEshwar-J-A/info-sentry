import { getOpenClawDb, disconnectAll } from "./lib/prisma.js";

async function main() {
  const db = getOpenClawDb();
  const scraped = await db.article.findMany({ 
    where: { status: "SCRAPED" }, 
    select: { id: true, title: true } 
  });
  console.log("SCRAPED:", scraped.length);
  
  const failed = await db.article.findMany({ 
    where: { status: "FAILED" }, 
    select: { id: true, title: true } 
  });
  console.log("FAILED:", failed);
  
  await disconnectAll();
}

main();
