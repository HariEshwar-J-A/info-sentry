import { PrismaClient } from "@prisma/client";
import "dotenv/config";

const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });

async function main() {
  const articles = await prisma.article.findMany({
    orderBy: { scrapedAt: "desc" },
    take: 5,
    include: { summary: true },
  });

  console.log("Articles:");
  for (const a of articles) {
    console.log(`- ${a.title.slice(0, 60)}... [${a.status}]`);
    if (a.status === "FAILED") {
      console.log("  -> Resetting to SCRAPED for retry");
      await prisma.article.update({ where: { id: a.id }, data: { status: "SCRAPED" } });
    }
  }

  // Also reset any analyzing
  await prisma.article.updateMany({
    where: { status: "ANALYZING" },
    data: { status: "SCRAPED" },
  });

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
