#!/usr/bin/env tsx
/**
 * source-quality.ts — Auto-adjust source trustScore based on article quality.
 *
 * For each source with ≥3 articles in the last 30 days, computes the average
 * relevanceScore and smoothly adjusts trustScore using EMA (α=0.3).
 * This rewards consistently high-quality sources and demotes noisy ones.
 *
 * Usage:
 *   npx tsx scripts/source-quality.ts          # dry run (show changes)
 *   npx tsx scripts/source-quality.ts --apply  # commit changes
 *
 * Recommended cron: 0 3 * * 1 (Mondays at 3am)
 */
import 'dotenv/config'
import { getScoutDb, disconnectAll } from './lib/prisma.js'

const MIN_ARTICLES = 3       // minimum articles to update trustScore
const LOOKBACK_DAYS = 30     // days of history to consider
const EMA_ALPHA = 0.3        // smoothing factor (0=no change, 1=jump to avg)
const MIN_TRUST = 0.1
const MAX_TRUST = 0.98

async function main() {
  const apply = process.argv.includes('--apply')
  const db = getScoutDb()

  const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000)

  // Aggregate average relevanceScore per source for recent articles
  const agg = await db.summary.groupBy({
    by: ['article'],
    where: {
      article: { scrapedAt: { gte: since }, status: { in: ['SUMMARIZED', 'POSTED'] } },
      relevanceScore: { not: null },
    },
    _avg: { relevanceScore: true },
    _count: { relevanceScore: true },
  }).catch(() => [])

  // groupBy with nested relations requires a different approach
  // Use raw aggregation via article.groupBy on sourceId
  const articleAgg = await db.article.groupBy({
    by: ['sourceId'],
    where: {
      scrapedAt: { gte: since },
      status: { in: ['SUMMARIZED', 'POSTED'] },
      summary: { isNot: null },
    },
    _count: { id: true },
  })

  // For each source with enough articles, compute avg relevance
  const sources = await db.source.findMany({
    select: { id: true, name: true, url: true, trustScore: true, type: true },
    where: { isActive: true },
  })

  const sourceMap = new Map(sources.map(s => [s.id, s]))
  const countMap = new Map(articleAgg.map(a => [a.sourceId, a._count.id]))

  console.log(`[source-quality] Checking ${sources.length} active sources (${LOOKBACK_DAYS}d window)`)
  let updated = 0

  for (const source of sources) {
    const articleCount = countMap.get(source.id) ?? 0
    if (articleCount < MIN_ARTICLES) continue

    // Compute avg relevance for this source's recent articles
    const avgResult = await db.summary.aggregate({
      where: {
        article: {
          sourceId: source.id,
          scrapedAt: { gte: since },
          status: { in: ['SUMMARIZED', 'POSTED'] },
        },
        relevanceScore: { not: null },
      },
      _avg: { relevanceScore: true },
    })

    const avgRelevance = avgResult._avg.relevanceScore
    if (avgRelevance === null) continue

    // Apply EMA: new_score = alpha * avg_relevance + (1-alpha) * current_trust
    const newScore = Math.max(MIN_TRUST, Math.min(MAX_TRUST,
      EMA_ALPHA * avgRelevance + (1 - EMA_ALPHA) * source.trustScore
    ))
    const delta = newScore - source.trustScore

    if (Math.abs(delta) < 0.005) continue  // skip negligible changes

    const direction = delta > 0 ? '↑' : '↓'
    console.log(`[source-quality]   ${direction} ${source.name}: ${source.trustScore.toFixed(3)} → ${newScore.toFixed(3)} (avg_rel=${avgRelevance.toFixed(3)}, n=${articleCount})`)

    if (apply) {
      await db.source.update({ where: { id: source.id }, data: { trustScore: newScore } })
      updated++
    }
  }

  if (!apply) {
    console.log('[source-quality] Dry run — pass --apply to commit changes')
  } else {
    console.log(`[source-quality] Updated ${updated} sources`)
  }

  await disconnectAll()
}

main().catch(err => {
  console.error('[source-quality] Fatal:', err)
  process.exit(1)
})
