-- Add new NotificationType enum values
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NEW_GITHUB_REPO';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NEW_VIDEO';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PIPELINE_SUMMARY';

-- Create PushSubscription table
CREATE TABLE IF NOT EXISTS "PushSubscription" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "endpoint"  TEXT NOT NULL,
    "p256dh"    TEXT NOT NULL,
    "auth"      TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
CREATE INDEX IF NOT EXISTS "PushSubscription_userId_idx" ON "PushSubscription"("userId");
