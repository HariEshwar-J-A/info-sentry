import { getOpenClawDb, disconnectAll } from "./lib/prisma.js";

async function main() {
  const db = getOpenClawDb();
  
  const byStatus = await db.article.groupBy({
    by: ['status'],
    _count: { id: true }
  });
  console.log("Articles by status:", byStatus);
  
  const recentSummaries = await db.summary.findMany({
    orderBy: { createdAt: 'desc' },
    take: 3,
    select: { 
      id: true, 
      article: { select: { title: true, status: true } },
      content: true,
      createdAt: true
    }
  });
  console.log("\nRecent summaries:", recentSummaries.map(s => ({
    title: s.article.title.slice(0, 50),
    status: s.article.status,
    createdAt: s.createdAt,
    contentPreview: s.content.slice(0, 100) + "..."
  })));
  
  await disconnectAll();
}

main();
