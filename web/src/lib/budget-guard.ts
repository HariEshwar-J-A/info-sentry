import { prisma } from '@/lib/prisma'

// Cache BudgetSettings for 60s to avoid a DB round-trip on every chat request
let cached: { mode: string; globalCapUsd: number; defaultPerUserCapUsd: number } | null = null
let cacheAt = 0

async function getSettings() {
  if (cached && Date.now() - cacheAt < 60_000) return cached
  const row = await prisma.budgetSettings.findUnique({ where: { id: 1 } })
  cached = row
    ? { mode: row.mode, globalCapUsd: row.globalCapUsd, defaultPerUserCapUsd: row.defaultPerUserCapUsd }
    : { mode: 'global', globalCapUsd: 7.30, defaultPerUserCapUsd: 1.00 }
  cacheAt = Date.now()
  return cached
}

const startOfMonth = () => {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

/**
 * Returns null if the user is allowed to make an AI call.
 * Returns a 429 Response if the monthly cap (global or per-user) is exceeded.
 */
export async function checkBudgetBeforeChat(userId: string): Promise<Response | null> {
  return checkBudgetBeforeProductCall(userId, 'iChat')
}

export async function checkBudgetBeforeProductCall(userId: string, product: string): Promise<Response | null> {
  try {
    const settings = await getSettings()
    const since = startOfMonth()

    if (settings.mode === 'global') {
      const agg = await prisma.costLog.aggregate({
        _sum: { totalCostUsd: true },
        where: { createdAt: { gte: since } },
      })
      const spent = agg._sum.totalCostUsd ?? 0
      if (spent >= settings.globalCapUsd) {
        return Response.json(
          { error: 'Monthly AI budget reached. Try again next month.' },
          { status: 429 }
        )
      }
      return null
    }

    // per_user mode
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { monthlyCapUsd: true },
    })
    const cap = user?.monthlyCapUsd ?? settings.defaultPerUserCapUsd

    const agg = await prisma.costLog.aggregate({
      _sum: { totalCostUsd: true },
      where: { userId, createdAt: { gte: since } },
    })
    const spent = agg._sum.totalCostUsd ?? 0
    if (spent >= cap) {
      return Response.json(
        {
          error: `Your $${cap.toFixed(2)}/mo free intelligence budget is used up. Paid plans for ${product} are coming soon — join the waitlist at /sentry/waitlist.`,
          code: 'BUDGET_EXCEEDED',
          spentUsd: spent,
          capUsd: cap,
        },
        { status: 429 }
      )
    }
    return null
  } catch {
    // Non-fatal — never block a chat due to budget check failure
    return null
  }
}

/** Invalidate the settings cache (call after admin updates BudgetSettings) */
export function invalidateBudgetCache() {
  cached = null
  cacheAt = 0
}
