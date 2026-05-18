#!/usr/bin/env tsx
/**
 * validation-queue.ts — Human-in-the-loop validation management
 *
 * Stores predictions awaiting user confirmation before posting
 * Usage:
 *   npx tsx scripts/validation-queue.ts --action=add --predictionId=abc --summary="..."
 *   npx tsx scripts/validation-queue.ts --action=list
 *   npx tsx scripts/validation-queue.ts --action=approve --id=xyz
 *   npx tsx scripts/validation-queue.ts --action=reject --id=xyz
 *   npx tsx scripts/validation-queue.ts --action=auto-approve-high-confidence
 */
import "dotenv/config";
import { getOpenClawDb, disconnectAll } from "./lib/prisma.js";

const CONFIDENCE_THRESHOLD = parseFloat(process.env["PREDICTION_CONFIDENCE_THRESHOLD"] ?? "0.6");
const AUTO_APPROVE = process.env["AUTO_APPROVE_PREDICTIONS"] === "true";

interface ValidationItem {
  id: string;
  predictionId: string;
  articleId: string;
  summary: string;
  predictions: { content: string; confidence: number; timeHorizon: string }[];
  confidence: number;
  submittedAt: Date;
  status: "PENDING" | "APPROVED" | "REJECTED" | "AUTO_APPROVED";
}

async function addToQueue(
  db: ReturnType<typeof getOpenClawDb>,
  data: {
    predictionId: string;
    articleId: string;
    summary: string;
    predictions: { content: string; confidence: number; timeHorizon: string }[];
  },
): Promise<{ action: "queued" | "auto_approved"; id?: string }> {
  const avgConfidence =
    data.predictions.reduce((sum, p) => sum + p.confidence, 0) / data.predictions.length;

  // Auto-approve high confidence if enabled
  if (AUTO_APPROVE && avgConfidence >= CONFIDENCE_THRESHOLD) {
    await db.validationQueue.create({
      data: {
        predictionId: data.predictionId,
        articleId: data.articleId,
        summary: data.summary,
        predictions: data.predictions,
        confidence: avgConfidence,
        status: "AUTO_APPROVED",
        resolvedAt: new Date(),
      },
    });
    return { action: "auto_approved" };
  }

  const item = await db.validationQueue.create({
    data: {
      predictionId: data.predictionId,
      articleId: data.articleId,
      summary: data.summary,
      predictions: data.predictions,
      confidence: avgConfidence,
      status: "PENDING",
    },
  });

  return { action: "queued", id: item.id };
}

async function listPending(db: ReturnType<typeof getOpenClawDb>): Promise<ValidationItem[]> {
  const items = await db.validationQueue.findMany({
    where: { status: "PENDING" },
    orderBy: { submittedAt: "asc" },
  });
  return items as unknown as ValidationItem[];
}

async function approve(
  db: ReturnType<typeof getOpenClawDb>,
  id: string,
): Promise<ValidationItem | null> {
  const item = await db.validationQueue.update({
    where: { id },
    data: { status: "APPROVED", resolvedAt: new Date() },
  });
  return item as unknown as ValidationItem | null;
}

async function reject(
  db: ReturnType<typeof getOpenClawDb>,
  id: string,
): Promise<ValidationItem | null> {
  const item = await db.validationQueue.update({
    where: { id },
    data: { status: "REJECTED", resolvedAt: new Date() },
  });
  return item as unknown as ValidationItem | null;
}

async function getApprovedForPosting(
  db: ReturnType<typeof getOpenClawDb>,
): Promise<ValidationItem[]> {
  const items = await db.validationQueue.findMany({
    where: { status: { in: ["APPROVED", "AUTO_APPROVED"] }, postedAt: null },
    orderBy: { resolvedAt: "asc" },
  });
  return items as unknown as ValidationItem[];
}

async function markPosted(
  db: ReturnType<typeof getOpenClawDb>,
  id: string,
): Promise<void> {
  await db.validationQueue.update({
    where: { id },
    data: { postedAt: new Date() },
  });
}

async function autoApproveHighConfidence(
  db: ReturnType<typeof getOpenClawDb>,
): Promise<number> {
  const result = await db.validationQueue.updateMany({
    where: {
      status: "PENDING",
      confidence: { gte: CONFIDENCE_THRESHOLD },
    },
    data: { status: "AUTO_APPROVED", resolvedAt: new Date() },
  });
  return result.count;
}

// CLI
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const flags: Record<string, string> = {};
  for (const arg of args) {
    const match = arg.match(/^--(\w+)(?:=(.*))?$/);
    if (match?.[1]) flags[match[1]] = match[2] ?? "true";
  }

  const db = getOpenClawDb();
  const action = flags["action"];

  switch (action) {
    case "add": {
      const predictionId = flags["predictionId"];
      const summary = decodeURIComponent(flags["summary"] ?? "");
      const predictionsJson = decodeURIComponent(flags["predictions"] ?? "");
      const articleId = flags["articleId"] ?? "";
      if (!predictionId || !summary || !predictionsJson) {
        console.error("Missing required flags: --predictionId, --summary, --predictions");
        process.exit(1);
      }
      let predictions: { content: string; confidence: number; timeHorizon: string }[];
      try {
        predictions = JSON.parse(predictionsJson);
      } catch {
        console.error("Failed to parse predictions JSON");
        process.exit(1);
      }
      const result = await addToQueue(db, {
        predictionId,
        articleId,
        summary,
        predictions,
      });
      console.log(JSON.stringify(result));
      break;
    }

    case "list": {
      const pending = await listPending(db);
      console.log(JSON.stringify(pending, null, 2));
      break;
    }

    case "approved": {
      const approved = await getApprovedForPosting(db);
      console.log(JSON.stringify(approved, null, 2));
      break;
    }

    case "approve": {
      const id = flags["id"];
      if (!id) {
        console.error("Missing --id");
        process.exit(1);
      }
      const item = await approve(db, id);
      console.log(JSON.stringify({ success: !!item, item }));
      break;
    }

    case "reject": {
      const id = flags["id"];
      if (!id) {
        console.error("Missing --id");
        process.exit(1);
      }
      const item = await reject(db, id);
      console.log(JSON.stringify({ success: !!item, item }));
      break;
    }

    case "auto-approve-high-confidence": {
      const count = await autoApproveHighConfidence(db);
      console.log(JSON.stringify({ autoApproved: count }));
      break;
    }

    default:
      console.log(`Usage:
  --action=add --predictionId=... --summary="..." --predictions='[...]'
  --action=list
  --action=approved
  --action=approve --id=...
  --action=reject --id=...
  --action=auto-approve-high-confidence`);
  }

  await disconnectAll();
}

main().catch((err) => {
  console.error("[validation-queue] Fatal:", err);
  process.exit(1);
});
