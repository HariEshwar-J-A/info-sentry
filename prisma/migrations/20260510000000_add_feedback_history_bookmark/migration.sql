-- CreateEnum
CREATE TYPE "FeedbackSignal" AS ENUM ('LIKE', 'DISLIKE', 'BOOKMARK', 'UNBOOKMARK', 'SKIP');

-- AlterTable
ALTER TABLE "ArticleInsight" ADD COLUMN "bookmarkedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Interest" ADD COLUMN "lastEngagedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "UserFeedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "signal" "FeedbackSignal" NOT NULL,
    "topics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserFeedback_userId_createdAt_idx" ON "UserFeedback"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UserFeedback_userId_signal_idx" ON "UserFeedback"("userId", "signal");

-- CreateIndex
CREATE INDEX "UserFeedback_articleId_idx" ON "UserFeedback"("articleId");

-- CreateIndex
CREATE INDEX "ArticleInsight_userId_bookmarkedAt_idx" ON "ArticleInsight"("userId", "bookmarkedAt");
