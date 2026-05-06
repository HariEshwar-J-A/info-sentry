-- AlterTable
ALTER TABLE "User" ALTER COLUMN "telegramId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "googleSub" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "picture" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_googleSub_key" ON "User"("googleSub");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_googleSub_idx" ON "User"("googleSub");
