import { prisma } from '@/lib/prisma'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.article.update({ where: { id }, data: { viewedAt: new Date() } })
    return Response.json({ success: true })
  } catch {
    return Response.json({ success: false }, { status: 500 })
  }
}
