import { prisma } from '@/lib/prisma'
import { requireUserId } from '@/lib/user'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = await requireUserId()
    const userId = auth instanceof Response ? null : auth.userId

    await prisma.article.update({ where: { id }, data: { viewedAt: new Date() } })

    // Auto-read any NEW_ARTICLE notification for this article
    if (userId) {
      await prisma.notification.updateMany({
        where: { userId, readAt: null, data: { path: ['articleId'], equals: id } },
        data: { readAt: new Date() },
      }).catch(() => {})
    }

    return Response.json({ success: true })
  } catch {
    return Response.json({ success: false }, { status: 500 })
  }
}
