import { PrismaClient as OpenClawPrismaClient } from "@prisma/openclaw-client";
import { PrismaClient as ScoutPrismaClient } from "@prisma/scout-client";

export type { OpenClawPrismaClient, ScoutPrismaClient };

// ─── OpenClaw Client (full access) ──────────────────────────
let openclawClient: OpenClawPrismaClient | undefined;

export function getOpenClawDb(): OpenClawPrismaClient {
  if (!openclawClient) {
    openclawClient = new OpenClawPrismaClient({
      datasourceUrl: process.env["DATABASE_URL"],
    });
  }
  return openclawClient;
}

// ─── Scout Client (restricted access) ───────────────────────
let scoutClient: ScoutPrismaClient | undefined;

export function getScoutDb(): ScoutPrismaClient {
  if (!scoutClient) {
    scoutClient = new ScoutPrismaClient({
      datasourceUrl: process.env["SCOUT_DATABASE_URL"],
    });
  }
  return scoutClient;
}

// ─── Graceful Shutdown ──────────────────────────────────────
export async function disconnectAll(): Promise<void> {
  await openclawClient?.$disconnect();
  await scoutClient?.$disconnect();
}
