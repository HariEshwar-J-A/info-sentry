#!/usr/bin/env tsx
/**
 * pipeline-run.ts — Full pipeline orchestrator.
 *
 * Runs analyst-run.ts then predictor-run.ts in sequence.
 * Used by the "Run Full Pipeline" button in the web UI and the cron job.
 *
 * Each agent runs independently with its own scope:
 *   analyst-run.ts  → SCRAPED → SUMMARIZED (analysis + Telegram summaries)
 *   predictor-run.ts → SUMMARIZED → POSTED  (predictions + Telegram predictions)
 */
import "dotenv/config";
import { spawn } from "node:child_process";
import path from "node:path";

const IGNORED_STDERR = [
  "The 'path' argument is deprecated",
  "Use --trace-deprecation",
];

function runStage(scriptPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["tsx", scriptPath], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "inherit", "pipe"],
    });

    let stderrBuf = "";
    child.stderr?.on("data", (chunk: Buffer) => { stderrBuf += chunk.toString(); });

    child.on("close", (code) => {
      const filtered = stderrBuf
        .split("\n")
        .filter((l) => l.trim() && !IGNORED_STDERR.some((s) => l.includes(s)))
        .join("\n");
      if (filtered) process.stderr.write(filtered + "\n");

      if (code === 0) resolve();
      else reject(new Error(`${path.basename(scriptPath)} exited with code ${code}`));
    });

    child.on("error", reject);
  });
}

async function main(): Promise<void> {
  console.log("[pipeline] Starting pipeline run");

  console.log("[pipeline] Stage 1: Analyst (SCRAPED → SUMMARIZED)");
  await runStage("scripts/analyst-run.ts");

  console.log("[pipeline] Stage 2: Predictor (SUMMARIZED → POSTED)");
  await runStage("scripts/predictor-run.ts");

  console.log("[pipeline] Pipeline run complete");
}

main().catch((err) => {
  console.error("[pipeline] Fatal:", err);
  process.exit(1);
});
