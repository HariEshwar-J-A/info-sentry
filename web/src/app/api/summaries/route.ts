import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUserId } from '@/lib/user'

export async function GET() {
  const auth = await requireUserId()
  if (auth instanceof Response) return auth
  const { userId } = auth

  try {
    const records = await prisma.notification.findMany({
      where: { userId, type: 'SYSTEM' },
      orderBy: { createdAt: 'desc' },
      take: 60,
    })

    // Split into daily briefs and weekly digests based on data.type
    const briefs  = records.filter(n => (n.data as Record<string, unknown>)?.['type'] === 'daily_brief')
    const digests = records.filter(n => (n.data as Record<string, unknown>)?.['type'] === 'weekly_digest')

    return NextResponse.json({ briefs, digests })
  } catch (err) {
    console.error('Summaries GET error:', err)
    return NextResponse.json({ briefs: [], digests: [] }, { status: 500 })
  }
}
