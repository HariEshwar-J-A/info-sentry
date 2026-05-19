import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUserId } from '@/lib/user'
import { predictionVisibilityWhere } from '@/lib/predictions'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUserId()
  if (auth instanceof Response) return auth
  const { userId } = auth

  const { id } = await params

  try {
    const prediction = await prisma.prediction.findFirst({
      where: { id, AND: [predictionVisibilityWhere(userId)] },
      include: {
        article: { select: { id: true, title: true, url: true } },
        evidence: { orderBy: { createdAt: 'desc' } },
        confidenceLogs: { orderBy: { createdAt: 'asc' } },
      },
    })

    if (!prediction) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(prediction)
  } catch (err) {
    console.error('Prediction detail error:', err)
    return NextResponse.json({ error: 'Failed to fetch prediction' }, { status: 500 })
  }
}

interface UpdateBody {
  title?: string
  category?: string
  dueDate?: string | null
  userContext?: string
  timeHorizon?: string
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUserId()
  if (auth instanceof Response) return auth
  const { userId } = auth

  const { id } = await params

  try {
    const body = (await request.json()) as UpdateBody

    const prediction = await prisma.prediction.findFirst({
      where: { id, userId, isUserDefined: true },
    })
    if (!prediction) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const updated = await prisma.prediction.update({
      where: { id },
      data: {
        ...(body.title !== undefined ? { title: body.title.slice(0, 120) } : {}),
        ...(body.category !== undefined ? { category: body.category } : {}),
        ...(body.dueDate !== undefined ? { dueDate: body.dueDate ? new Date(body.dueDate) : null } : {}),
        ...(body.userContext !== undefined ? { userContext: body.userContext } : {}),
        ...(body.timeHorizon !== undefined ? { timeHorizon: body.timeHorizon } : {}),
      },
    })

    return NextResponse.json(updated)
  } catch (err) {
    console.error('Update prediction error:', err)
    return NextResponse.json({ error: 'Failed to update prediction' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUserId()
  if (auth instanceof Response) return auth
  const { userId } = auth

  const { id } = await params

  try {
    const prediction = await prisma.prediction.findFirst({
      where: { id, userId, isUserDefined: true },
    })
    if (!prediction) return NextResponse.json({ error: 'Not found or not deletable' }, { status: 404 })

    await prisma.prediction.delete({ where: { id } })
    return NextResponse.json({ deleted: true })
  } catch (err) {
    console.error('Delete prediction error:', err)
    return NextResponse.json({ error: 'Failed to delete prediction' }, { status: 500 })
  }
}
