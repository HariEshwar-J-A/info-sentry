import { prisma } from '@/lib/prisma'
import { openrouter, CHAT_MODEL } from '@/lib/openrouter'
import { OWNER_USER_ID } from '@/lib/user'

interface ChatBody {
  message: string
  history: { role: 'user' | 'assistant'; content: string }[]
}

async function buildSystemPrompt(): Promise<string> {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const [articles, interests, predictions] = await Promise.all([
    prisma.article.findMany({
      where: {
        scrapedAt: { gte: since24h },
        status: { in: ['SUMMARIZED', 'POSTED'] },
        summary: { isNot: null },
      },
      include: {
        source: { select: { name: true } },
        summary: {
          select: {
            content: true,
            keyTopics: true,
            sentimentScore: true,
            relevanceScore: true,
          },
        },
      },
      orderBy: { summary: { relevanceScore: 'desc' } },
      take: 15,
    }),
    prisma.interest.findMany({
      where: { userId: OWNER_USER_ID, isActive: true },
      orderBy: { score: 'desc' },
      take: 10,
    }),
    prisma.prediction.findMany({
      where: { status: 'PENDING' },
      orderBy: { confidence: 'desc' },
      take: 8,
    }),
  ])

  type ArticleRow = (typeof articles)[number]
  type InterestRow = (typeof interests)[number]
  type PredRow = (typeof predictions)[number]

  const articleList = articles
    .map((a: ArticleRow, i: number) => {
      const relevancePct = a.summary?.relevanceScore
        ? `${Math.round(a.summary.relevanceScore * 100)}%`
        : '?'
      const topics = a.summary?.keyTopics?.join(', ') ?? 'none'
      const excerpt = (a.summary?.content ?? '').slice(0, 300)
      const sentiment = a.summary?.sentimentScore != null
        ? `${(a.summary.sentimentScore * 100).toFixed(0)}%`
        : '?'

      return `${i + 1}. [${a.source.name}] ${a.title}
   Topics: ${topics}
   Relevance: ${relevancePct} | Sentiment: ${sentiment}
   Summary: ${excerpt}...`
    })
    .join('\n\n')

  const interestList = interests.map((i: InterestRow) => `- ${i.topic} (score: ${i.score.toFixed(1)})`).join('\n')

  const predictionList = predictions
    .map(
      (p: PredRow) =>
        `- [${Math.round(p.confidence * 100)}% confidence] ${p.content}${p.timeHorizon ? ` (${p.timeHorizon})` : ''}`
    )
    .join('\n')

  return `You are Info-Sentry, a personal AI news intelligence assistant. You have access to a curated feed of news articles tailored to the user's interests. Your job is to provide insightful analysis, answer questions about current events, and help the user navigate the news intelligently.

Today's date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

## Top Articles (Last 24 hours, by relevance)

${articleList || 'No articles found in the last 24 hours.'}

## User's Active Interests

${interestList || 'No interests configured.'}

## Pending Predictions

${predictionList || 'No pending predictions.'}

## Instructions

- Answer questions based on the articles above when relevant
- Be concise but insightful — 2-4 paragraphs max unless asked for more
- Reference specific articles by source when making claims
- If asked about something not covered in the articles, say so clearly
- Use markdown formatting for clarity when helpful (lists, bold text)
- Be direct and analytical — the user values intelligence over pleasantries`
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ChatBody
    const { message, history = [] } = body

    if (!message?.trim()) {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const systemPrompt = await buildSystemPrompt()

    const messages = [
      ...history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user' as const, content: message },
    ]

    const stream = await openrouter.chat.completions.create({
      model: CHAT_MODEL,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      stream: true,
      max_tokens: 1024,
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
          console.error('Stream error:', err)
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
  } catch (error) {
    console.error('Chat API error:', error)
    return new Response(JSON.stringify({ error: 'Failed to process chat request' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
