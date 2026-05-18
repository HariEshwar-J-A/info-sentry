-- CreateEnum
CREATE TYPE "VideoPlatform" AS ENUM ('YOUTUBE', 'TIKTOK', 'INSTAGRAM', 'PODCAST');

-- CreateTable
CREATE TABLE "VideoChannel" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "VideoPlatform" NOT NULL DEFAULT 'YOUTUBE',
    "channelId" TEXT NOT NULL,
    "channelName" TEXT NOT NULL,
    "channelUrl" TEXT NOT NULL,
    "rssFeedUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastScanned" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoItem" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "duration" TEXT,
    "publishedAt" TIMESTAMP(3),
    "transcript" TEXT,
    "aiSummary" TEXT,
    "viewedAt" TIMESTAMP(3),
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VideoChannel_channelUrl_key" ON "VideoChannel"("channelUrl");
CREATE INDEX "VideoChannel_userId_isActive_idx" ON "VideoChannel"("userId", "isActive");
CREATE INDEX "VideoChannel_platform_idx" ON "VideoChannel"("platform");

-- CreateIndex
CREATE UNIQUE INDEX "VideoItem_url_key" ON "VideoItem"("url");
CREATE UNIQUE INDEX "VideoItem_channelId_videoId_key" ON "VideoItem"("channelId", "videoId");
CREATE INDEX "VideoItem_channelId_publishedAt_idx" ON "VideoItem"("channelId", "publishedAt");
CREATE INDEX "VideoItem_publishedAt_idx" ON "VideoItem"("publishedAt");

-- AddForeignKey
ALTER TABLE "VideoItem" ADD CONSTRAINT "VideoItem_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "VideoChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
