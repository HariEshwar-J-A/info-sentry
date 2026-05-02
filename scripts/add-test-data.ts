import { PrismaClient } from "@prisma/client";
import "dotenv/config";

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

async function main() {
  const adminId = process.env.TELEGRAM_ADMIN_ID!;

  // Get or create admin user
  let user = await prisma.user.findUnique({ where: { telegramId: adminId } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        telegramId: adminId,
        username: "admin",
        isAdmin: true,
      },
    });
  }

  // Create test interest
  const interest = await prisma.interest.upsert({
    where: { userId_topic: { userId: user.id, topic: "Artificial Intelligence" } },
    update: {},
    create: {
      userId: user.id,
      topic: "Artificial Intelligence",
      description: "Latest AI developments, LLMs, and agent systems",
      score: 1.0,
      isActive: true,
    },
  });

  // Create test source
  const source = await prisma.source.upsert({
    where: { url: "https://techcrunch.com/category/artificial-intelligence/" },
    update: {},
    create: {
      name: "TechCrunch AI",
      url: "https://techcrunch.com/category/artificial-intelligence/",
      type: "WEB",
      trustScore: 0.7,
      isActive: true,
      crawlMethod: "CHEERIO",
    },
  });

  // Link them
  await prisma.interestSource.upsert({
    where: {
      interestId_sourceId: { interestId: interest.id, sourceId: source.id },
    },
    update: {},
    create: {
      interestId: interest.id,
      sourceId: source.id,
    },
  });

  console.log("Test data created:");
  console.log("- User:", user.id);
  console.log("- Interest:", interest.topic);
  console.log("- Source:", source.name);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
