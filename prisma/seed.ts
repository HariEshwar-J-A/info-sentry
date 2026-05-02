import { PrismaClient } from "@prisma/client";
import "dotenv/config";

const prisma = new PrismaClient({
  datasourceUrl: process.env["DATABASE_URL"],
});

async function main(): Promise<void> {
  const adminTelegramId = process.env["TELEGRAM_ADMIN_ID"];
  if (!adminTelegramId) {
    throw new Error("TELEGRAM_ADMIN_ID must be set in .env for seeding");
  }

  // 1. Create admin user
  const admin = await prisma.user.upsert({
    where: { telegramId: adminTelegramId },
    update: {},
    create: {
      telegramId: adminTelegramId,
      username: "admin",
      isAdmin: true,
    },
  });
  console.log(`Admin user ready: ${admin.id}`);

  // 2. Create default agent configs
  const agents = [
    {
      agentName: "scout",
      cronSchedule: "0 */2 * * *",
      settings: { maxPagesPerRun: 50, maxConcurrency: 5 },
    },
    {
      agentName: "analyst",
      cronSchedule: null,
      settings: { maxSummaryLength: 500 },
    },
    {
      agentName: "prediction",
      cronSchedule: null,
      settings: { minConfidence: 0.3, maxPredictionsPerArticle: 3 },
    },
    {
      agentName: "feedback",
      cronSchedule: null,
      settings: { maxHistoryMessages: 20 },
    },
    {
      agentName: "manager",
      cronSchedule: "*/15 * * * *",
      settings: { budgetWarningThreshold: 0.8, healthCheckEnabled: true },
    },
  ];

  for (const agent of agents) {
    await prisma.agentConfig.upsert({
      where: { agentName: agent.agentName },
      update: {},
      create: agent,
    });
    console.log(`Agent config ready: ${agent.agentName}`);
  }

  console.log("Seed completed successfully.");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
