import { prisma } from './prisma'
import { OWNER_USER_ID } from './user'

export interface ArticleWithSummary {
  id: string
  title: string
  url: string
  status: string
  scrapedAt: Date
  source: {
    id: string
    name: string
    trustScore: number
  }
  summary: {
    id: string
    content: string
    keyTopics: string[]
    sentimentScore: number | null
    relevanceScore: number | null
  } | null
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
}): Promise<ArticleWithSummary[]> {
  const { hours = 48, topic, minRelevance = 0 } = options ?? {}

  const since = new Date(Date.now() - hours * 60 * 60 * 1000)

  const articles = await prisma.article.findMany({
    where: {
      scrapedAt: { gte: since },
      status: { in: ['SUMMARIZED', 'POSTED'] },
      summary: {
        relevanceScore: { gte: minRelevance },
        ...(topic ? { keyTopics: { has: topic } } : {}),
      },
    },
    include: {
      source: { select: { id: true, name: true, trustScore: true } },
      summary: {
        select: {
          id: true,
          content: true,
          keyTopics: true,
          sentimentScore: true,
          relevanceScore: true,
        },
      },
    },
    orderBy: [
      { summary: { relevanceScore: 'desc' } },
      { scrapedAt: 'desc' },
    ],
    take: 50,
  })

  return articles as ArticleWithSummary[]
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
        select: {
          id: true,
          content: true,
          keyTopics: true,
          sentimentScore: true,
          relevanceScore: true,
        },
      },
    },
    orderBy: { scrapedAt: 'desc' },
    take: 200,
  })

  const topicMap = new Map<string, ArticleWithSummary[]>()

  for (const article of articles as ArticleWithSummary[]) {
    if (!article.summary) continue
    for (const topic of article.summary.keyTopics) {
      if (!topicMap.has(topic)) topicMap.set(topic, [])
      topicMap.get(topic)!.push(article)
    }
  }

  const clusters: TopicCluster[] = []

  for (const [topic, topicArticles] of Array.from(topicMap.entries())) {
    const withScores = topicArticles.filter((a: ArticleWithSummary) => a.summary?.relevanceScore != null)
    const avgRelevance =
      withScores.length > 0
        ? withScores.reduce((s: number, a: ArticleWithSummary) => s + (a.summary?.relevanceScore ?? 0), 0) / withScores.length
        : 0

    const withSentiment = topicArticles.filter((a: ArticleWithSummary) => a.summary?.sentimentScore != null)
    const avgSentiment =
      withSentiment.length > 0
        ? withSentiment.reduce((s: number, a: ArticleWithSummary) => s + (a.summary?.sentimentScore ?? 0), 0) /
          withSentiment.length
        : 0

    clusters.push({
      topic,
      articleCount: topicArticles.length,
      avgRelevance,
      avgSentiment,
      articles: topicArticles.slice(0, 5),
    })
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
        summary: {
          select: {
            id: true,
            content: true,
            keyTopics: true,
            sentimentScore: true,
            relevanceScore: true,
          },
        },
      },
      orderBy: { scrapedAt: 'desc' },
      take: 200,
    }),
    prisma.interest.findMany({
      where: { userId: OWNER_USER_ID, isActive: true },
    }),
  ])

  const interestMap = new Map<string, number>()
  for (const interest of interests) {
    interestMap.set(interest.topic.toLowerCase(), interest.score)
  }

  const now = Date.now()

  const scored = (articles as ArticleWithSummary[])
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
      predictions: {
        orderBy: { confidence: 'desc' },
      },
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
      where: {
        createdAt: {
          gte: new Date(year, month - 1, 1),
          lt: new Date(year, month, 1),
        },
      },
      _sum: { totalCostUsd: true },
    }),
  ])

  const spentUsd = costLogs._sum.totalCostUsd ?? 0
  const budgetUsd = budget?.budgetUsd ?? 7.3

  return { spentUsd, budgetUsd, percent: Math.min((spentUsd / budgetUsd) * 100, 100) }
}
