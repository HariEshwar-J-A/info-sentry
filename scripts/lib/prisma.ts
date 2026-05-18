import { PrismaClient } from "@prisma/client";

export type { PrismaClient };

// ─── Single Database Client ─────────────────────────────────
// Using unified client for both scout and openclaw operations
// Database roles enforced at application level, not connection level

let client: PrismaClient | undefined;

export function getOpenClawDb(): PrismaClient {
  if (!client) {
    client = new PrismaClient({
      datasourceUrl: process.env["DATABASE_URL"],
    });
  }
  return client;
}

// Scout uses same client (simplified for single-user setup)
export function getScoutDb(): PrismaClient {
  return getOpenClawDb();
}

// ─── Graceful Shutdown ──────────────────────────────────────
export async function disconnectAll(): Promise<void> {
  await client?.$disconnect();
}
