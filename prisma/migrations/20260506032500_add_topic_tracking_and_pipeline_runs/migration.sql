-- AlterTable
ALTER TABLE "Interest"
ADD COLUMN     "trackNews" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "trackGithub" BOOLEAN NOT NULL DEFAULT false;

-- CreateEnum
CREATE TYPE "PipelineKind" AS ENUM ('NEWS', 'GITHUB');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "PipelineRun" (
    "id" TEXT NOT NULL,
    "interestId" TEXT,
    "kind" "PipelineKind" NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "exitCode" INTEGER,
    "errorMessage" TEXT,
    "stats" JSONB,
    "logTail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PipelineRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PipelineRun_interestId_startedAt_idx" ON "PipelineRun"("interestId", "startedAt");

-- CreateIndex
CREATE INDEX "PipelineRun_status_idx" ON "PipelineRun"("status");

-- CreateIndex
CREATE INDEX "PipelineRun_kind_startedAt_idx" ON "PipelineRun"("kind", "startedAt");

-- AddForeignKey
ALTER TABLE "PipelineRun" ADD CONSTRAINT "PipelineRun_interestId_fkey" FOREIGN KEY ("interestId") REFERENCES "Interest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
