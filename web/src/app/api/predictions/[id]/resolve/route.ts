import { prisma } from '@/lib/prisma'
import { openrouter } from '@/lib/openrouter'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { resolution, userNotes } = (await request.json()) as {
      resolution: 'CORRECT' | 'INCORRECT' | 'PARTIALLY_CORRECT'
      userNotes?: string
    }

    const prediction = await prisma.prediction.findUnique({
      where: { id },
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
Article: "${prediction.article.title}"
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

    const updated = await prisma.prediction.update({
      where: { id },
      data: {
        status: resolution,
        resolvedAt: new Date(),
        outcome: resolution,
        resolutionAnalysis,
        ...(userNotes ? { userNotes } : {}),
      },
    })

    return Response.json({ success: true, resolutionAnalysis, prediction: updated })
  } catch (err) {
    console.error('Resolve prediction error:', err)
    return Response.json({ error: 'Failed to resolve prediction' }, { status: 500 })
  }
}
