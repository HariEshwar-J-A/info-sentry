#!/usr/bin/env tsx
/**
 * openclaw-integration.ts — Command interface for Vision to control Info-Sentry
 *
 * This script serves as the bridge between Vision (OpenClaw) and Info-Sentry.
 * Vision spawns subagents that call this with specific commands.
 *
 * Usage:
 *   npx tsx scripts/openclaw-integration.ts --command=status
 *   npx tsx scripts/openclaw-integration.ts --command=scout --interest="AI"
 *   npx tsx scripts/openclaw-integration.ts --command=pipeline
 *   npx tsx scripts/openclaw-integration.ts --command=budget
 *   npx tsx scripts/openclaw-integration.ts --command=digest
 *   npx tsx scripts/openclaw-integration.ts --command=pending-validations
 *   npx tsx scripts/openclaw-integration.ts --command=approve --id=validationId
 *   npx tsx scripts/openclaw-integration.ts --command=reject --id=validationId
 *   npx tsx scripts/openclaw-integration.ts --command=health
 *   npx tsx scripts/openclaw-integration.ts --command=psc-summary
 *   npx tsx scripts/openclaw-integration.ts --command=install-check
 */
import "dotenv/config";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getOpenClawDb, disconnectAll } from "./lib/prisma.js";
import { getBudgetStatus, formatBudgetStatus } from "./lib/budget.js";

const exec = promisify(execFile);
const TSX = process.platform === "win32" ? "npx.cmd" : "npx";

interface CommandResult {
  success: boolean;
  message: string;
  data?: unknown;
  error?: string;
}

async function runScript(script: string, args: string[] = []): Promise<string> {
  try {
    const { stdout, stderr } = await exec(TSX, ["tsx", script, ...args], {
      cwd: process.cwd(),
      env: process.env,
      timeout: 300_000, // 5 minutes for long operations
    });
    if (stderr && !stderr.includes("ExperimentalWarning")) {
      console.warn(`[${script}] stderr:`, stderr.trim());
    }
    return stdout.trim();
  } catch (err) {
    const error = err as Error & { stderr?: string };
    throw new Error(`Script ${script} failed: ${error.message}${error.stderr ? "\n" + error.stderr : ""}`);
  }
}

// Command handlers
async function cmdStatus(): Promise<CommandResult> {
  const db = getOpenClawDb();
  const [agents, articles, summaries, predictions, pendingValidations, budget] = await Promise.all([
    db.agentConfig.findMany({
      select: { agentName: true, isActive: true, lastRunAt: true, lastError: true },
    }),
    db.article.count(),
    db.summary.count(),
    db.prediction.count(),
    db.validationQueue.count({ where: { status: "PENDING" } }),
    getBudgetStatus(),
  ]);

  const lines = [
    "📊 Info-Sentry Status",
    "",
    "<b>Agents:</b>",
    ...agents.map((a) => `• ${a.agentName}: ${a.isActive ? "✅" : "⏸️"} (last: ${a.lastRunAt?.toLocaleString() ?? "never"})`),
    "",
    "<b>Data:</b>",
    `• Articles: ${articles}`,
    `• Summaries: ${summaries}`,
    `• Predictions: ${predictions}`,
    pendingValidations > 0 ? `• ⏳ Pending Validations: ${pendingValidations}` : "",
    "",
    formatBudgetStatus(budget).replace(/\n/g, " | "),
  ];

  return {
    success: true,
    message: lines.filter(Boolean).join("\n"),
    data: { agents, counts: { articles, summaries, predictions, pendingValidations }, budget },
  };
}

async function cmdScout(interest?: string): Promise<CommandResult> {
  // Check budget first
  const budget = await getBudgetStatus();
  if (budget.remainingUsd < 0.05) {
    return {
      success: false,
      message: "❌ Cannot run scout: Budget too low (<$0.05 remaining)",
      data: { budget },
    };
  }

  console.log("[openclaw] Starting scout run...");
  const output = await runScript("scripts/scout-run.ts");
  console.log("[openclaw] Scout output:", output);

  return {
    success: true,
    message: `✅ Scout completed\n\n${output}`,
  };
}

async function cmdPipeline(): Promise<CommandResult> {
  // Check budget
  const budget = await getBudgetStatus();
  if (budget.remainingUsd < 0.10) {
    return {
      success: false,
      message: "❌ Cannot run pipeline: Budget too low (<$0.10 remaining). Daily digest only.",
      data: { budget },
    };
  }

  console.log("[openclaw] Starting pipeline run...");
  const output = await runScript("scripts/pipeline-run.ts");
  console.log("[openclaw] Pipeline output:", output);

  // Check for pending validations
  const db = getOpenClawDb();
  const pending = await db.validationQueue.count({ where: { status: "PENDING" } });

  return {
    success: true,
    message: `✅ Pipeline completed${pending > 0 ? `\n⏳ ${pending} prediction(s) awaiting your validation` : ""}\n\n${output.slice(0, 500)}...`,
    data: { pendingValidations: pending },
  };
}

async function cmdBudget(): Promise<CommandResult> {
  const budget = await getBudgetStatus();
  const percent = (budget.percentUsed * 100).toFixed(1);
  const tier = budget.percentUsed > 0.9 ? 4 : budget.percentUsed > 0.7 ? 3 : budget.percentUsed > 0.4 ? 2 : 1;

  return {
    success: true,
    message: formatBudgetStatus(budget) + `\n\nCurrent Tier: ${tier}/4 (${tier === 4 ? "FREE MODELS" : tier === 1 ? "PREMIUM" : "ECONOMY"})`,
    data: { budget, tier },
  };
}

async function cmdDigest(): Promise<CommandResult> {
  console.log("[openclaw] Sending daily digest...");
  const output = await runScript("scripts/daily-digest.ts");
  return {
    success: true,
    message: "✅ Daily digest sent to Telegram",
    data: { output },
  };
}

async function cmdPendingValidations(): Promise<CommandResult> {
  const db = getOpenClawDb();
  const pending = await db.validationQueue.findMany({
    where: { status: "PENDING" },
    orderBy: { confidence: "desc" },
    take: 10,
  });

  if (pending.length === 0) {
    return {
      success: true,
      message: "✅ No pending validations. All predictions processed!",
      data: { count: 0 },
    };
  }

  const lines = [
    `⏳ ${pending.length} Prediction(s) Awaiting Validation`,
    "",
    ...pending.map((p, i) => {
      const predictions = p.predictions as { content: string; confidence: number; timeHorizon: string }[];
      return `${i + 1}. Confidence: ${(p.confidence * 100).toFixed(0)}%\n   ${predictions[0]?.content.slice(0, 80)}...`;
    }),
  ];

  return {
    success: true,
    message: lines.join("\n"),
    data: { pending, count: pending.length },
  };
}

async function cmdApprove(id: string): Promise<CommandResult> {
  const output = await runScript("scripts/validation-queue.ts", [`--action=approve`, `--id=${id}`]);
  return {
    success: true,
    message: `✅ Approved validation ${id}`,
    data: JSON.parse(output),
  };
}

async function cmdReject(id: string): Promise<CommandResult> {
  const output = await runScript("scripts/validation-queue.ts", [`--action=reject`, `--id=${id}`]);
  return {
    success: true,
    message: `❌ Rejected validation ${id}`,
    data: JSON.parse(output),
  };
}

async function cmdHealth(): Promise<CommandResult> {
  const output = await runScript("scripts/health-check.ts");
  const health = JSON.parse(output);

  const allActive = health.agents.every((a: { isActive: boolean }) => a.isActive);
  return {
    success: allActive,
    message: allActive
      ? "✅ All systems healthy"
      : `⚠️ Some agents inactive: ${health.agents.filter((a: { isActive: boolean }) => !a.isActive).map((a: { name: string }) => a.name).join(", ")}`,
    data: health,
  };
}

async function cmdPscSummary(): Promise<CommandResult> {
  // PSC = Personal Security Council - a summary for your security review
  const db = getOpenClawDb();
  const budget = await getBudgetStatus();

  const [recentArticles, recentPredictions, validations] = await Promise.all([
    db.article.findMany({
      orderBy: { scrapedAt: "desc" },
      take: 5,
      include: { summary: true },
    }),
    db.prediction.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.validationQueue.findMany({
      where: { status: { in: ["APPROVED", "AUTO_APPROVED"] } },
      orderBy: { resolvedAt: "desc" },
      take: 3,
    }),
  ]);

  const lines = [
    "🔒 PSC Security Brief",
    `Generated: ${new Date().toISOString()}`,
    "",
    "<b>System Status:</b>",
    `• Budget Health: ${budget.percentUsed > 0.9 ? "🔴 CRITICAL" : budget.percentUsed > 0.7 ? "🟡 WARNING" : "🟢 OK"}`,
    `• Daily Spend: $${(budget.todaySpendUsd * 1.37).toFixed(2)} CAD`,
    `• Projected Monthly: $${(budget.projectedMonthlySpend * 1.37).toFixed(2)} CAD`,
    "",
    "<b>Recent Activity:</b>",
    ...recentArticles.map((a) => `• ${a.title.slice(0, 50)}${a.title.length > 50 ? "..." : ""}`),
    "",
    "<b>Recent Predictions:</b>",
    ...recentPredictions.map((p) => `• [${(p.confidence * 100).toFixed(0)}%] ${p.content.slice(0, 50)}...`),
  ];

  return {
    success: true,
    message: lines.join("\n"),
    data: { budget, recentArticles, recentPredictions, validations },
  };
}

async function cmdInstallCheck(): Promise<CommandResult> {
  const checks = {
    database: false,
    chromadb: false,
    openrouter: false,
    telegram: false,
  };

  // Check database
  try {
    const db = getOpenClawDb();
    await db.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch {
    checks.database = false;
  }

  // Check ChromaDB
  try {
    const res = await fetch(`${process.env["CHROMA_URL"]}/api/v2/heartbeat`);
    checks.chromadb = res.ok;
  } catch {
    checks.chromadb = false;
  }

  // Check OpenRouter
  try {
    const apiKey = process.env["OPENROUTER_API_KEY"];
    checks.openrouter = !!apiKey && apiKey.length > 10 && apiKey !== "***";
  } catch {
    checks.openrouter = false;
  }

  // Check Telegram
  checks.telegram = !!process.env["TELEGRAM_BOT_TOKEN"] && !!process.env["TELEGRAM_ADMIN_ID"];

  const allGood = Object.values(checks).every(Boolean);

  return {
    success: allGood,
    message: [
      allGood ? "✅ All systems ready" : "⚠️ Some systems not ready",
      "",
      ...Object.entries(checks).map(([k, v]) => `${v ? "✅" : "❌"} ${k}`),
      "",
      !checks.database ? "Run: npm run db:migrate && npm run db:seed" : "",
      !checks.chromadb ? "Run: docker-compose up -d chroma" : "",
      !checks.openrouter ? "Set OPENROUTER_API_KEY in .env" : "",
      !checks.telegram ? "Set TELEGRAM_BOT_TOKEN and TELEGRAM_ADMIN_ID in .env" : "",
    ].filter(Boolean).join("\n"),
    data: checks,
  };
}

// Main CLI
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const flags: Record<string, string> = {};
  for (const arg of args) {
    const match = arg.match(/^--(\w+)(?:=(.*))?$/);
    if (match?.[1]) {
      flags[match[1]] = match[2] ?? "true";
    }
  }

  const command = flags["command"];
  let result: CommandResult;

  try {
    switch (command) {
      case "status":
        result = await cmdStatus();
        break;
      case "scout":
        result = await cmdScout(flags["interest"]);
        break;
      case "pipeline":
        result = await cmdPipeline();
        break;
      case "budget":
        result = await cmdBudget();
        break;
      case "digest":
        result = await cmdDigest();
        break;
      case "pending-validations":
        result = await cmdPendingValidations();
        break;
      case "approve":
        if (!flags["id"]) throw new Error("Missing --id");
        result = await cmdApprove(flags["id"]);
        break;
      case "reject":
        if (!flags["id"]) throw new Error("Missing --id");
        result = await cmdReject(flags["id"]);
        break;
      case "health":
        result = await cmdHealth();
        break;
      case "psc-summary":
        result = await cmdPscSummary();
        break;
      case "install-check":
        result = await cmdInstallCheck();
        break;
      default:
        result = {
          success: false,
          message: `Unknown command: ${command}`,
          error: "Available commands: status, scout, pipeline, budget, digest, pending-validations, approve, reject, health, psc-summary, install-check",
        };
    }
  } catch (err) {
    const error = err as Error;
    result = {
      success: false,
      message: `❌ Command failed: ${error.message}`,
      error: error.stack,
    };
  }

  console.log(JSON.stringify(result, null, 2));
  await disconnectAll();

  process.exit(result.success ? 0 : 1);
}

main().catch((err) => {
  console.error("[openclaw-integration] Fatal:", err);
  process.exit(1);
});
