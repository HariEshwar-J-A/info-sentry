import { prisma } from '@/lib/prisma'
import { openrouter, CHAT_MODEL } from '@/lib/openrouter'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: articleId } = await params
    const { message, history = [] } = (await request.json()) as {
      message: string
      history: { role: 'user' | 'assistant'; content: string }[]
    }

    const article = await prisma.article.findUnique({
      where: { id: articleId },
      include: {
        source: { select: { name: true } },
        summary: { select: { content: true, keyTopics: true, sentimentScore: true } },
      },
    })

    if (!article) {
      return Response.json({ error: 'Article not found' }, { status: 404 })
    }

    const sentimentLabel =
      (article.summary?.sentimentScore ?? 0) > 0.3
        ? 'positive'
        : (article.summary?.sentimentScore ?? 0) < -0.3
        ? 'negative'
        : 'neutral'

    const systemPrompt = `You are Info-Sentry, discussing the following article with the user.

**Article:** ${article.title}
**Source:** ${article.source.name}
**Topics:** ${article.summary?.keyTopics?.join(', ') ?? 'unknown'}
**Sentiment:** ${sentimentLabel}

**Summary:**
${article.summary?.content?.slice(0, 800) ?? 'Not yet summarized.'}

Help the user analyze, question, and explore their reactions to this article. Be conversational but analytically sharp. Offer implications, context, and connections to broader trends. Format all responses as markdown.`

    const messages = [
      ...history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user' as const, content: message },
    ]

    const stream = await openrouter.chat.completions.create({
      model: CHAT_MODEL,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      stream: true,
      max_tokens: 800,
      temperature: 0.7,
    })

    const encoder = new TextEncoder()

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const token = chunk.choices[0]?.delta?.content ?? ''
            if (token) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(token)}\n\n`))
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        } catch (err) {
          console.error('Article chat stream error:', err)
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (err) {
    console.error('Article chat error:', err)
    return Response.json({ error: 'Failed to start article chat' }, { status: 500 })
  }
}
