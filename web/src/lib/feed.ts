import { prisma } from './prisma'
import { OWNER_USER_ID } from './user'
import { openrouter } from './openrouter'

export interface PredictionSnippet {
  id: string
  content: string
  confidence: number
  status: string
  timeHorizon: string | null
  trackedByUser: boolean
  resolutionAnalysis: string | null
  viewedAt: Date | null
}

export interface ArticleInsightSnippet {
  userSentiment: string | null
  keywords: string[]
}

export interface ArticleWithSummary {
  id: string
  title: string
  url: string
  status: string
  scrapedAt: Date
  publishedAt: Date | null
  viewedAt: Date | null
  source: { id: string; name: string; trustScore: number }
  summary: {
    id: string
    content: string
    keyTopics: string[]
    sentimentScore: number | null
    relevanceScore: number | null
  } | null
  predictions: PredictionSnippet[]
  insight: ArticleInsightSnippet | null
}

export interface TopicCluster {
  topic: string
  articleCount: number
  avgRelevance: number
  avgSentiment: number
  articles: ArticleWithSummary[]
}

export interface SurpriseArticle extends ArticleWithSummary {
  surpriseScore: number
}

export async function getFeedArticles(options?: {
  hours?: number
  topic?: string
  minRelevance?: number
  keyword?: string
  sort?: 'relevance' | 'date' | 'sentiment'
  sentimentMin?: number
  sentimentMax?: number
  dateFrom?: Date
  dateTo?: Date
}): Promise<ArticleWithSummary[]> {
  const {
    hours = 48,
    topic,
    minRelevance = 0,
    keyword,
    sort = 'relevance',
    sentimentMin,
    sentimentMax,
    dateFrom,
    dateTo,
  } = options ?? {}

  const since = new Date(Date.now() - hours * 60 * 60 * 1000)

  const sentimentFilter =
    sentimentMin !== undefined || sentimentMax !== undefined
      ? {
          sentimentScore: {
            ...(sentimentMin !== undefined ? { gte: sentimentMin } : {}),
            ...(sentimentMax !== undefined ? { lte: sentimentMax } : {}),
          },
        }
      : {}

  const articles = await prisma.article.findMany({
    where: {
      scrapedAt: { gte: dateFrom ?? since },
      ...(dateTo ? { scrapedAt: { lte: dateTo } } : {}),
      status: { in: ['SUMMARIZED', 'POSTED'] },
      summary: {
        relevanceScore: { gte: minRelevance },
        ...(topic ? { keyTopics: { has: topic } } : {}),
        ...sentimentFilter,
        ...(keyword
          ? {
              OR: [
                { content: { contains: keyword, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      ...(keyword
        ? {
            OR: [
              { title: { contains: keyword, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    include: {
      source: { select: { id: true, name: true, trustScore: true } },
      summary: {
        select: { id: true, content: true, keyTopics: true, sentimentScore: true, relevanceScore: true },
      },
      predictions: {
        orderBy: { confidence: 'desc' },
        take: 3,
        select: {
          id: true,
          content: true,
          confidence: true,
          status: true,
          timeHorizon: true,
          trackedByUser: true,
          resolutionAnalysis: true,
          viewedAt: true,
        },
      },
      insight: {
        select: { userSentiment: true, keywords: true },
      },
    },
    orderBy:
      sort === 'date'
        ? [{ publishedAt: 'desc' }, { scrapedAt: 'desc' }]
        : sort === 'sentiment'
        ? [{ summary: { sentimentScore: 'desc' } }]
        : [{ summary: { relevanceScore: 'desc' } }, { scrapedAt: 'desc' }],
    take: 60,
  })

  return articles as unknown as ArticleWithSummary[]
}

export async function searchArticlesByAI(query: string): Promise<ArticleWithSummary[]> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const candidates = await prisma.article.findMany({
    where: {
      scrapedAt: { gte: since },
      status: { in: ['SUMMARIZED', 'POSTED'] },
      summary: { isNot: null },
    },
    include: {
      source: { select: { id: true, name: true, trustScore: true } },
      summary: {
        select: { id: true, content: true, keyTopics: true, sentimentScore: true, relevanceScore: true },
      },
      predictions: {
        take: 3,
        orderBy: { confidence: 'desc' },
        select: { id: true, content: true, confidence: true, status: true, timeHorizon: true, trackedByUser: true, resolutionAnalysis: true },
      },
      insight: { select: { userSentiment: true, keywords: true } },
    },
    orderBy: { scrapedAt: 'desc' },
    take: 40,
  })

  if (candidates.length === 0) return []

  const articleList = candidates
    .map((a, i) => `${i}: [${a.id}] ${a.title} | Topics: ${a.summary?.keyTopics?.join(', ') ?? 'none'}`)
    .join('\n')

  try {
    const completion = await openrouter.chat.completions.create({
      model: 'google/gemini-2.0-flash-001',
      messages: [
        {
          role: 'user',
          content: `Given this user query: "${query}"

Rank these articles by relevance. Return ONLY a JSON object like: {"articleIds": ["id1", "id2", "id3"]}
Include up to 15 most relevant IDs, most relevant first.

Articles:
${articleList}`,
        },
      ],
      max_tokens: 300,
      temperature: 0.2,
    })

    const raw = completion.choices[0]?.message?.content ?? '{}'
    const cleaned = raw.replace(/```json?\n?|\n?```/g, '').trim()
    const { articleIds } = JSON.parse(cleaned) as { articleIds: string[] }

    const idOrder = new Map(articleIds.map((id, i) => [id, i]))
    return (candidates as unknown as ArticleWithSummary[])
      .filter((a) => idOrder.has(a.id))
      .sort((a, b) => (idOrder.get(a.id) ?? 99) - (idOrder.get(b.id) ?? 99))
  } catch {
    return candidates as unknown as ArticleWithSummary[]
  }
}

export async function getTopicClusters(): Promise<TopicCluster[]> {
  const since = new Date(Date.now() - 72 * 60 * 60 * 1000)

  const articles = await prisma.article.findMany({
    where: {
      scrapedAt: { gte: since },
      status: { in: ['SUMMARIZED', 'POSTED'] },
      summary: { isNot: null },
    },
    include: {
      source: { select: { id: true, name: true, trustScore: true } },
      summary: {
        select: { id: true, content: true, keyTopics: true, sentimentScore: true, relevanceScore: true },
      },
      predictions: { take: 2, orderBy: { confidence: 'desc' }, select: { id: true, content: true, confidence: true, status: true, timeHorizon: true, trackedByUser: true, resolutionAnalysis: true } },
      insight: { select: { userSentiment: true, keywords: true } },
    },
    orderBy: { scrapedAt: 'desc' },
    take: 200,
  })

  const topicMap = new Map<string, ArticleWithSummary[]>()

  for (const article of articles as unknown as ArticleWithSummary[]) {
    if (!article.summary) continue
    for (const topic of article.summary.keyTopics) {
      if (!topicMap.has(topic)) topicMap.set(topic, [])
      topicMap.get(topic)!.push(article)
    }
  }

  const clusters: TopicCluster[] = []

  for (const [topic, topicArticles] of Array.from(topicMap.entries())) {
    const withScores = topicArticles.filter((a) => a.summary?.relevanceScore != null)
    const avgRelevance = withScores.length > 0
      ? withScores.reduce((s, a) => s + (a.summary?.relevanceScore ?? 0), 0) / withScores.length
      : 0

    const withSentiment = topicArticles.filter((a) => a.summary?.sentimentScore != null)
    const avgSentiment = withSentiment.length > 0
      ? withSentiment.reduce((s, a) => s + (a.summary?.sentimentScore ?? 0), 0) / withSentiment.length
      : 0

    clusters.push({ topic, articleCount: topicArticles.length, avgRelevance, avgSentiment, articles: topicArticles.slice(0, 5) })
  }

  return clusters.sort((a, b) => b.articleCount - a.articleCount).slice(0, 20)
}

export async function getSurpriseArticles(limit = 10): Promise<SurpriseArticle[]> {
  const since = new Date(Date.now() - 72 * 60 * 60 * 1000)

  const [articles, interests] = await Promise.all([
    prisma.article.findMany({
      where: {
        scrapedAt: { gte: since },
        status: { in: ['SUMMARIZED', 'POSTED'] },
        summary: { isNot: null },
      },
      include: {
        source: { select: { id: true, name: true, trustScore: true } },
        summary: { select: { id: true, content: true, keyTopics: true, sentimentScore: true, relevanceScore: true } },
        predictions: { take: 2, orderBy: { confidence: 'desc' }, select: { id: true, content: true, confidence: true, status: true, timeHorizon: true, trackedByUser: true, resolutionAnalysis: true } },
        insight: { select: { userSentiment: true, keywords: true } },
      },
      orderBy: { scrapedAt: 'desc' },
      take: 200,
    }),
    prisma.interest.findMany({ where: { userId: OWNER_USER_ID, isActive: true } }),
  ])

  const interestMap = new Map<string, number>()
  for (const interest of interests) {
    interestMap.set(interest.topic.toLowerCase(), interest.score)
  }

  const now = Date.now()

  const scored = (articles as unknown as ArticleWithSummary[])
    .filter((a) => a.summary != null)
    .map((article) => {
      const relevance = article.summary?.relevanceScore ?? 0
      const ageMs = now - new Date(article.scrapedAt).getTime()
      const ageDays = ageMs / (1000 * 60 * 60 * 24)
      const recencyDecay = Math.exp(-ageDays * 0.5)

      const topics = article.summary?.keyTopics ?? []
      const maxInterestScore = topics.reduce((max, topic) => {
        const score = interestMap.get(topic.toLowerCase()) ?? 1.0
        return Math.max(max, score)
      }, 1.0)

      const surpriseScore = (1 / maxInterestScore) * relevance * recencyDecay
      return { ...article, surpriseScore }
    })

  return scored.sort((a, b) => b.surpriseScore - a.surpriseScore).slice(0, limit)
}

export async function getArticleDetail(id: string) {
  return prisma.article.findUnique({
    where: { id },
    include: {
      source: true,
      summary: true,
      predictions: { orderBy: { confidence: 'desc' } },
      insight: true,
    },
  })
}

export async function getActiveInterests() {
  return prisma.interest.findMany({
    where: { userId: OWNER_USER_ID, isActive: true },
    orderBy: { score: 'desc' },
  })
}

export async function getMonthlyBudget() {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  const [budget, costLogs] = await Promise.all([
    prisma.budgetStatus.findUnique({ where: { year_month: { year, month } } }),
    prisma.costLog.aggregate({
      where: { createdAt: { gte: new Date(year, month - 1, 1), lt: new Date(year, month, 1) } },
      _sum: { totalCostUsd: true },
    }),
  ])

  const spentUsd = costLogs._sum.totalCostUsd ?? 0
  const budgetUsd = budget?.budgetUsd ?? 7.3
  return { spentUsd, budgetUsd, percent: Math.min((spentUsd / budgetUsd) * 100, 100) }
}
