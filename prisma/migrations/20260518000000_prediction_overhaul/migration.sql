-- Phase 1: Drop old CASCADE FK on articleId
ALTER TABLE "Prediction" DROP CONSTRAINT IF EXISTS "Prediction_articleId_fkey";

-- Phase 2: Make articleId nullable
ALTER TABLE "Prediction" ALTER COLUMN "articleId" DROP NOT NULL;

-- Phase 3: Add new columns
ALTER TABLE "Prediction" ADD COLUMN IF NOT EXISTS "userId"          TEXT;
ALTER TABLE "Prediction" ADD COLUMN IF NOT EXISTS "title"           TEXT;
ALTER TABLE "Prediction" ADD COLUMN IF NOT EXISTS "category"        TEXT;
ALTER TABLE "Prediction" ADD COLUMN IF NOT EXISTS "userContext"     TEXT;
ALTER TABLE "Prediction" ADD COLUMN IF NOT EXISTS "isUserDefined"   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Prediction" ADD COLUMN IF NOT EXISTS "aiConfidence"    DOUBLE PRECISION;
ALTER TABLE "Prediction" ADD COLUMN IF NOT EXISTS "aiAnalysis"      TEXT;
ALTER TABLE "Prediction" ADD COLUMN IF NOT EXISTS "lastAnalyzedAt"  TIMESTAMP(3);

-- Phase 4: Re-add FK with SET NULL (was CASCADE)
ALTER TABLE "Prediction" ADD CONSTRAINT "Prediction_articleId_fkey"
  FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Phase 5: New indexes
CREATE INDEX IF NOT EXISTS "Prediction_userId_status_idx" ON "Prediction"("userId", "status");
CREATE INDEX IF NOT EXISTS "Prediction_isUserDefined_idx" ON "Prediction"("isUserDefined");

-- Phase 6: PredictionEvidence table
CREATE TABLE IF NOT EXISTS "PredictionEvidence" (
    "id"           TEXT NOT NULL,
    "predictionId" TEXT NOT NULL,
    "articleId"    TEXT,
    "url"          TEXT,
    "title"        TEXT,
    "impact"       DOUBLE PRECISION NOT NULL,
    "summary"      TEXT NOT NULL,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PredictionEvidence_pkey" PRIMARY KEY ("id")
);

-- Partial unique index: only unique when articleId IS NOT NULL (NULLs don't conflict)
CREATE UNIQUE INDEX IF NOT EXISTS "PredictionEvidence_predictionId_articleId_key"
  ON "PredictionEvidence"("predictionId", "articleId")
  WHERE "articleId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "PredictionEvidence_predictionId_createdAt_idx"
  ON "PredictionEvidence"("predictionId", "createdAt");

ALTER TABLE "PredictionEvidence"
  ADD CONSTRAINT "PredictionEvidence_predictionId_fkey"
  FOREIGN KEY ("predictionId") REFERENCES "Prediction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Phase 7: PredictionConfidenceLog table
CREATE TABLE IF NOT EXISTS "PredictionConfidenceLog" (
    "id"           TEXT NOT NULL,
    "predictionId" TEXT NOT NULL,
    "confidence"   DOUBLE PRECISION NOT NULL,
    "source"       TEXT NOT NULL,
    "note"         TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PredictionConfidenceLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PredictionConfidenceLog_predictionId_createdAt_idx"
  ON "PredictionConfidenceLog"("predictionId", "createdAt");

ALTER TABLE "PredictionConfidenceLog"
  ADD CONSTRAINT "PredictionConfidenceLog_predictionId_fkey"
  FOREIGN KEY ("predictionId") REFERENCES "Prediction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
