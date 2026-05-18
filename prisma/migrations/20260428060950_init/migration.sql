-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('WEB', 'RSS', 'API');

-- CreateEnum
CREATE TYPE "CrawlMethod" AS ENUM ('CHEERIO', 'PLAYWRIGHT');

-- CreateEnum
CREATE TYPE "ArticleStatus" AS ENUM ('SCRAPED', 'ANALYZING', 'SUMMARIZED', 'POSTED', 'FAILED');

-- CreateEnum
CREATE TYPE "PredictionStatus" AS ENUM ('PENDING', 'CORRECT', 'INCORRECT', 'PARTIALLY_CORRECT', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ValidationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'AUTO_APPROVED');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "telegramId" TEXT NOT NULL,
    "username" TEXT,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "description" TEXT,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Interest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" "SourceType" NOT NULL DEFAULT 'WEB',
    "trustScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "crawlMethod" "CrawlMethod" NOT NULL DEFAULT 'CHEERIO',
    "rssUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterestSource" (
    "id" TEXT NOT NULL,
    "interestId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterestSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "rawFilePath" TEXT,
    "status" "ArticleStatus" NOT NULL DEFAULT 'SCRAPED',
    "scrapedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "analyzedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Summary" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "keyTopics" TEXT[],
    "sentimentScore" DOUBLE PRECISION,
    "relevanceScore" DOUBLE PRECISION,
    "chromaId" TEXT,
    "telegramMsgId" INTEGER,
    "telegramTopicId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Summary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prediction" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "timeHorizon" TEXT,
    "status" "PredictionStatus" NOT NULL DEFAULT 'PENDING',
    "telegramMsgId" INTEGER,
    "telegramTopicId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "outcome" TEXT,

    CONSTRAINT "Prediction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValidationQueue" (
    "id" TEXT NOT NULL,
    "predictionId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "predictions" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "status" "ValidationStatus" NOT NULL DEFAULT 'PENDING',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "postedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,

    CONSTRAINT "ValidationQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PredictionOutcome" (
    "id" TEXT NOT NULL,
    "predictionId" TEXT NOT NULL,
    "expectedOutcome" TEXT NOT NULL,
    "actualOutcome" TEXT,
    "accuracyScore" DOUBLE PRECISION,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PredictionOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "agentName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentConfig" (
    "id" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "cronSchedule" TEXT,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "lastRunAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostLog" (
    "id" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL,
    "completionTokens" INTEGER NOT NULL,
    "totalCostUsd" DOUBLE PRECISION NOT NULL,
    "openrouterGenId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CostLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetStatus" (
    "id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "budgetUsd" DOUBLE PRECISION NOT NULL,
    "spentUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dailyBudgetUsd" DOUBLE PRECISION NOT NULL,
    "currentTier" INTEGER NOT NULL DEFAULT 2,
    "lastCheckAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alertsSent" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "BudgetStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForumTopic" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "telegramTopicId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForumTopic_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramId_key" ON "User"("telegramId");

-- CreateIndex
CREATE INDEX "User_telegramId_idx" ON "User"("telegramId");

-- CreateIndex
CREATE INDEX "Interest_isActive_idx" ON "Interest"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Interest_userId_topic_key" ON "Interest"("userId", "topic");

-- CreateIndex
CREATE UNIQUE INDEX "Source_url_key" ON "Source"("url");

-- CreateIndex
CREATE INDEX "Source_isActive_idx" ON "Source"("isActive");

-- CreateIndex
CREATE INDEX "Source_trustScore_idx" ON "Source"("trustScore");

-- CreateIndex
CREATE UNIQUE INDEX "InterestSource_interestId_sourceId_key" ON "InterestSource"("interestId", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "Article_url_key" ON "Article"("url");

-- CreateIndex
CREATE INDEX "Article_scrapedAt_idx" ON "Article"("scrapedAt");

-- CreateIndex
CREATE INDEX "Article_status_idx" ON "Article"("status");

-- CreateIndex
CREATE INDEX "Article_createdAt_idx" ON "Article"("createdAt");

-- CreateIndex
CREATE INDEX "Article_sourceId_scrapedAt_idx" ON "Article"("sourceId", "scrapedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Summary_articleId_key" ON "Summary"("articleId");

-- CreateIndex
CREATE INDEX "Prediction_status_idx" ON "Prediction"("status");

-- CreateIndex
CREATE INDEX "Prediction_createdAt_idx" ON "Prediction"("createdAt");

-- CreateIndex
CREATE INDEX "ValidationQueue_status_idx" ON "ValidationQueue"("status");

-- CreateIndex
CREATE INDEX "ValidationQueue_submittedAt_idx" ON "ValidationQueue"("submittedAt");

-- CreateIndex
CREATE INDEX "ValidationQueue_confidence_idx" ON "ValidationQueue"("confidence");

-- CreateIndex
CREATE INDEX "PredictionOutcome_predictionId_idx" ON "PredictionOutcome"("predictionId");

-- CreateIndex
CREATE INDEX "PredictionOutcome_verifiedAt_idx" ON "PredictionOutcome"("verifiedAt");

-- CreateIndex
CREATE INDEX "ChatMessage_userId_createdAt_idx" ON "ChatMessage"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AgentConfig_agentName_key" ON "AgentConfig"("agentName");

-- CreateIndex
CREATE INDEX "CostLog_agentName_createdAt_idx" ON "CostLog"("agentName", "createdAt");

-- CreateIndex
CREATE INDEX "CostLog_createdAt_idx" ON "CostLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetStatus_year_month_key" ON "BudgetStatus"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "ForumTopic_name_key" ON "ForumTopic"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ForumTopic_telegramTopicId_key" ON "ForumTopic"("telegramTopicId");

-- AddForeignKey
ALTER TABLE "Interest" ADD CONSTRAINT "Interest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterestSource" ADD CONSTRAINT "InterestSource_interestId_fkey" FOREIGN KEY ("interestId") REFERENCES "Interest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterestSource" ADD CONSTRAINT "InterestSource_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Summary" ADD CONSTRAINT "Summary_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prediction" ADD CONSTRAINT "Prediction_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
