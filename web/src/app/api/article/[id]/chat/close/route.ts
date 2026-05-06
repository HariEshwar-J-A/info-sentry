import { prisma } from '@/lib/prisma'
import { openrouter } from '@/lib/openrouter'
import { requireUserId } from '@/lib/user'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUserId()
  if (auth instanceof Response) return auth
  const { userId } = auth
  try {
    const { id: articleId } = await params
    const { history = [] } = (await request.json()) as {
      history: { role: string; content: string }[]
    }

    if (history.length === 0) {
      return Response.json({ error: 'No conversation to summarize' }, { status: 400 })
    }

    const conversationText = history
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n\n')

    const completion = await openrouter.chat.completions.create({
      model: 'google/gemini-2.0-flash-001',
      messages: [
        {
          role: 'system',
          content: `You analyze conversations about news articles and extract key insights. Return ONLY a JSON object with no markdown fencing.`,
        },
        {
          role: 'user',
          content: `Analyze this conversation about a news article and return a JSON object:

${conversationText}

Return this exact JSON structure:
{
  "chatSummary": "2-3 sentence summary of what the user expressed and found interesting",
  "userSentiment": "one of: curious, concerned, excited, skeptical, neutral",
  "keywords": ["3-8 specific topic keywords extracted from what the user cared about"]
}`,
        },
      ],
      max_tokens: 400,
      temperature: 0.3,
    })

    let insight: { chatSummary: string; userSentiment: string; keywords: string[] }
    try {
      const raw = completion.choices[0]?.message?.content ?? '{}'
      const cleaned = raw.replace(/```json?\n?|\n?```/g, '').trim()
      insight = JSON.parse(cleaned) as typeof insight
    } catch {
      insight = { chatSummary: 'User discussed this article.', userSentiment: 'neutral', keywords: [] }
    }

    // Upsert ArticleInsight
    await prisma.articleInsight.upsert({
      where: { articleId },
      create: {
        articleId,
        userId,
        chatSummary: insight.chatSummary,
        userSentiment: insight.userSentiment,
        keywords: insight.keywords,
        rawChatLog: history,
      },
      update: {
        chatSummary: insight.chatSummary,
        userSentiment: insight.userSentiment,
        keywords: insight.keywords,
        rawChatLog: history,
        updatedAt: new Date(),
      },
    })

    // Feedback loop: update Interest.searchKeywords for matched topics
    if (insight.keywords.length > 0) {
      const interests = await prisma.interest.findMany({
        where: { userId, isActive: true },
        select: { id: true, topic: true, score: true, searchKeywords: true },
      })

      for (const interest of interests) {
        const matched = insight.keywords.some(
          (kw) =>
            kw.toLowerCase().includes(interest.topic.toLowerCase()) ||
            interest.topic.toLowerCase().includes(kw.toLowerCase())
        )
        if (matched) {
          const merged = [...new Set([...interest.searchKeywords, ...insight.keywords])].slice(0, 20)
          await prisma.interest.update({
            where: { id: interest.id },
            data: {
              searchKeywords: merged,
              score: Math.min(5.0, interest.score + 0.05),
            },
          })
        }
      }
    }

    return Response.json({ insight })
  } catch (err) {
    console.error('Article chat close error:', err)
    return Response.json({ error: 'Failed to save insights' }, { status: 500 })
  }
}
