-- Create enum for MediaType
CREATE TYPE "MediaType" AS ENUM ('VIDEO', 'AUDIO', 'PODCAST');

-- Create MediaContent table
CREATE TABLE "MediaContent" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "type" "MediaType" NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "duration" TEXT,
    "transcript" TEXT,
    "extractedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaContent_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX "MediaContent_articleId_type_idx" ON "MediaContent"("articleId", "type");
CREATE INDEX "MediaContent_createdAt_idx" ON "MediaContent"("createdAt");

-- Add foreign key constraint
ALTER TABLE "MediaContent" ADD CONSTRAINT "MediaContent_articleId_fkey"
    FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
