import { PrismaClient } from "@prisma/client";
import "dotenv/config";

const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });

async function main() {
  // Delete all test data
  await prisma.validationQueue.deleteMany();
  await prisma.predictionOutcome.deleteMany();
  await prisma.prediction.deleteMany();
  await prisma.summary.deleteMany();
  await prisma.article.deleteMany();

  console.log("All test data cleared");

  // Delete interest-source links
  await prisma.interestSource.deleteMany();

  // Delete sources and interests
  await prisma.source.deleteMany();
  await prisma.interest.deleteMany();

  console.log("Sources and interests cleared");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
