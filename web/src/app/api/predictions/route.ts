import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUserId } from '@/lib/user'

interface CreatePredictionBody {
  title: string
  content: string
  category?: string
  confidence: number   // 0–100
  timeHorizon?: string
  dueDate?: string
  userContext?: string
}

export async function POST(request: Request) {
  const auth = await requireUserId()
  if (auth instanceof Response) return auth
  const { userId } = auth

  try {
    const body = (await request.json()) as CreatePredictionBody
    const { title, content, category, confidence, timeHorizon, dueDate, userContext } = body

    if (!title?.trim()) return NextResponse.json({ error: 'title is required' }, { status: 400 })
    if (!content?.trim()) return NextResponse.json({ error: 'content is required' }, { status: 400 })
    if (typeof confidence !== 'number' || confidence < 0 || confidence > 100) {
      return NextResponse.json({ error: 'confidence must be 0–100' }, { status: 400 })
    }

    const confidenceDecimal = confidence / 100

    const prediction = await prisma.prediction.create({
      data: {
        userId,
        title: title.trim().slice(0, 120),
        content: content.trim(),
        category: category ?? null,
        userContext: userContext?.trim() ?? null,
        confidence: confidenceDecimal,
        timeHorizon: timeHorizon ?? null,
        dueDate: dueDate ? new Date(dueDate) : null,
        isUserDefined: true,
        status: 'PENDING',
        trackedByUser: true,
        trackedAt: new Date(),
      },
    })

    // Seed initial confidence log for chart
    await prisma.predictionConfidenceLog.create({
      data: {
        predictionId: prediction.id,
        confidence: confidenceDecimal,
        source: 'user_created',
        note: 'Initial confidence set by user',
      },
    })

    return NextResponse.json(prediction, { status: 201 })
  } catch (err) {
    console.error('Create prediction error:', err)
    return NextResponse.json({ error: 'Failed to create prediction' }, { status: 500 })
  }
}
