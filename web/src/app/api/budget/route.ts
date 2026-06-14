import { NextResponse } from 'next/server'
import { getMonthlyBudget } from '@/lib/feed'
import { prisma } from '@/lib/prisma'
import { requireUserId } from '@/lib/user'
import { invalidateBudgetCache } from '@/lib/budget-guard'
import { parseBody, z } from '@/lib/validate'

export async function GET() {
  try {
    const [budget, settings] = await Promise.all([
      getMonthlyBudget(),
      prisma.budgetSettings.findUnique({ where: { id: 1 } }),
    ])
    return NextResponse.json({
      ...budget,
      mode:                 settings?.mode                 ?? 'global',
      globalCapUsd:         settings?.globalCapUsd         ?? 7.30,
      defaultPerUserCapUsd: settings?.defaultPerUserCapUsd ?? 1.00,
    })
  } catch (error) {
    console.error('Budget API error:', error)
    return NextResponse.json(
      { spentUsd: 0, budgetUsd: 7.3, percent: 0, mode: 'global', globalCapUsd: 7.30, defaultPerUserCapUsd: 1.00 },
      { status: 200 }
    )
  }
}

const BudgetPatchSchema = z.object({
  mode:                 z.enum(['global', 'per_user']).optional(),
  globalCapUsd:         z.number().positive().max(1000).optional(),
  defaultPerUserCapUsd: z.number().positive().max(100).optional(),
})

// Admin-only: update budget mode and caps
export async function PATCH(request: Request) {
  const auth = await requireUserId()
  if (auth instanceof Response) return auth
  const { userId } = auth

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true } })
  if (!user?.isAdmin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const parsed = await parseBody(BudgetPatchSchema, request)
  if (parsed instanceof Response) return parsed

  const settings = await prisma.budgetSettings.upsert({
    where:  { id: 1 },
    update: parsed.data,
    create: { id: 1, mode: 'global', globalCapUsd: 7.30, defaultPerUserCapUsd: 1.00, ...parsed.data },
  })

  invalidateBudgetCache()
  return NextResponse.json(settings)
}
