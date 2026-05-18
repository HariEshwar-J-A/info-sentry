import { PrismaClient } from "@prisma/client";
import "dotenv/config";

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

async function main() {
  const now = new Date();
  await prisma.budgetStatus.create({
    data: {
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      budgetUsd: 7.30,
      dailyBudgetUsd: 0.24,
      currentTier: 2,
    },
  });
  console.log("Budget initialized for", now.getMonth() + 1, "/", now.getFullYear());
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
