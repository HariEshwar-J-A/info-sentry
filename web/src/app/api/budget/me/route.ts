import { prisma } from '@/lib/prisma'
import { requireUserId } from '@/lib/user'

const startOfMonth = () => {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export async function GET() {
  const auth = await requireUserId()
  if (auth instanceof Response) return auth
  const { userId } = auth

  try {
    const [user, settings, agg] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { monthlyCapUsd: true } }),
      prisma.budgetSettings.findUnique({ where: { id: 1 } }),
      prisma.costLog.aggregate({
        _sum: { totalCostUsd: true },
        where: { userId, createdAt: { gte: startOfMonth() } },
      }),
    ])

    const defaultCap = settings?.defaultPerUserCapUsd ?? 1.00
    const capUsd = user?.monthlyCapUsd ?? defaultCap
    const spentUsd = Number(agg._sum.totalCostUsd ?? 0)
    const percent = capUsd > 0 ? Math.min(100, (spentUsd / capUsd) * 100) : 0

    return Response.json({ spentUsd, capUsd, percent })
  } catch {
    return Response.json({ spentUsd: 0, capUsd: 1.00, percent: 0 })
  }
}
