import { prisma } from '@/lib/prisma'
import { requireUserId } from '@/lib/user'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const repo = await prisma.gitHubRepo.findUnique({
      where: { id },
      select: {
        id: true, owner: true, repoName: true, fullName: true,
        description: true, url: true, stars: true, forks: true,
        watchers: true, language: true, topics: true, aiSummary: true,
        readme: true, lastPushed: true, scrapedAt: true, viewedAt: true,
        interestId: true, starDelta: true, forkDelta: true,
        previousStars: true, fetchCount: true,
      },
    })
    if (!repo) return Response.json({ error: 'Not found' }, { status: 404 })
    return Response.json({ repo })
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const { action } = await req.json().catch(() => ({ action: 'viewed' })) as { action?: string }
    if (action === 'viewed') {
      await prisma.gitHubRepo.update({ where: { id }, data: { viewedAt: new Date() } })

      // Auto-read any NEW_GITHUB_REPO notification for this repo
      const auth = await requireUserId()
      if (!(auth instanceof Response)) {
        await prisma.notification.updateMany({
          where: { userId: auth.userId, readAt: null, data: { path: ['repoId'], equals: id } },
          data: { readAt: new Date() },
        }).catch(() => {})
      }
    }
    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
