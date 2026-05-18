import { prisma } from '@/lib/prisma'
import { openrouter } from '@/lib/openrouter'
import { requireUserId } from '@/lib/user'
import { predictionVisibilityWhere } from '@/lib/predictions'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUserId()
  if (auth instanceof Response) return auth
  const { userId } = auth

  try {
    const { id } = await params
    const { resolution, userNotes } = (await request.json()) as {
      resolution: 'CORRECT' | 'INCORRECT' | 'PARTIALLY_CORRECT'
      userNotes?: string
    }

    const prediction = await prisma.prediction.findFirst({
      where: {
        AND: [
          { id },
          predictionVisibilityWhere(userId),
        ],
      },
      include: { article: { select: { title: true } } },
    })

    if (!prediction) {
      return Response.json({ error: 'Prediction not found' }, { status: 404 })
    }

    // AI analysis of resolution
    const resolutionLabel = resolution.replace('_', ' ').toLowerCase()
    let resolutionAnalysis = ''

    try {
      const completion = await openrouter.chat.completions.create({
        model: 'google/gemini-2.0-flash-001',
        messages: [
          {
            role: 'user',
            content: `This prediction was marked as ${resolutionLabel}:

Prediction: "${prediction.content}"
${prediction.article ? `Article: "${prediction.article.title}"` : `Title: "${prediction.title ?? prediction.content.slice(0, 80)}"`}
Confidence was: ${Math.round(prediction.confidence * 100)}%
Time horizon: ${prediction.timeHorizon ?? 'unspecified'}

In 2-3 sentences, analyze what factors likely contributed to this outcome. Be specific and analytical. Focus on what signals were present or absent.`,
          },
        ],
        max_tokens: 200,
        temperature: 0.4,
      })
      resolutionAnalysis = completion.choices[0]?.message?.content ?? ''
    } catch {
      resolutionAnalysis = `Prediction marked as ${resolutionLabel}.`
    }

    const finalConfidence = resolution === 'CORRECT' ? 0.95 : resolution === 'INCORRECT' ? 0.05 : 0.5
    const [updated] = await prisma.$transaction([
      prisma.prediction.update({
        where: { id },
        data: {
          status: resolution,
          resolvedAt: new Date(),
          outcome: resolution,
          resolutionAnalysis,
          aiConfidence: finalConfidence,
          ...(userNotes ? { userNotes } : {}),
        },
      }),
      prisma.predictionConfidenceLog.create({
        data: {
          predictionId: id,
          confidence: finalConfidence,
          source: 'manual_resolve',
          note: `Manually resolved as ${resolutionLabel}`,
        },
      }),
    ])

    return Response.json({ success: true, resolutionAnalysis, prediction: updated })
  } catch (err) {
    console.error('Resolve prediction error:', err)
    return Response.json({ error: 'Failed to resolve prediction' }, { status: 500 })
  }
}
