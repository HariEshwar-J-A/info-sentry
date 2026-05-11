/**
 * When agents are started from the web Settings UI, `INFO_SENTRY_USER_ID` is set so scripts
 * only touch that user's topics, linked sources, and downstream articles/predictions/repos.
 * Cron / Telegram / OpenClaw leaves it unset → legacy behaviour (process all active interests).
 */
import type { Prisma } from "@prisma/client";

export function pipelineUserIdFromEnv(): string | undefined {
  const v = process.env["INFO_SENTRY_USER_ID"]?.trim();
  return v || undefined;
}

/** Interest rows for scout / GitHub jobs. */
export function interestWhereClause(opts: {
  interestId?: string | null;
  userId?: string | null;
}): Prisma.InterestWhereInput {
  return {
    isActive: true,
    ...(opts.interestId ? { id: opts.interestId } : {}),
    ...(opts.userId ? { userId: opts.userId } : {}),
  };
}

/** Article.source filter: linked InterestSource must match optional interest + optional owner user. */
export function sourceInterestScope(opts: {
  interestId?: string | null;
  userId?: string | null;
}): Prisma.SourceWhereInput | undefined {
  const { interestId, userId } = opts;
  if (!interestId && !userId) return undefined;
  return {
    interests: {
      some: {
        ...(interestId ? { interestId } : {}),
        ...(userId ? { interest: { userId } } : {}),
      },
    },
  };
}

export function articleWhereScoped(opts: {
  interestId?: string | null;
  userId?: string | null;
}): Prisma.ArticleWhereInput | undefined {
  const src = sourceInterestScope(opts);
  if (!src) return undefined;
  return { source: src };
}
