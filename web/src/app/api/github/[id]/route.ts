import { prisma } from '@/lib/prisma'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const { action } = await req.json().catch(() => ({ action: 'viewed' })) as { action?: string }
    if (action === 'viewed') {
      await prisma.gitHubRepo.update({ where: { id }, data: { viewedAt: new Date() } })
    }
    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
