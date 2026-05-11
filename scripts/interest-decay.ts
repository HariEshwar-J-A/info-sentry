#!/usr/bin/env tsx
/**
 * interest-decay.ts — Weekly decay of inactive interests.
 *
 * Interests not engaged in ≥14 days have their score reduced by 10%.
 * This keeps the system's attention aligned with what the user actually reads.
 *
 * Usage:
 *   npx tsx scripts/interest-decay.ts          # dry run (log only)
 *   npx tsx scripts/interest-decay.ts --apply  # apply decay
 */
import 'dotenv/config'
import { getScoutDb, disconnectAll } from './lib/prisma.js'

async function main() {
  const apply = process.argv.includes('--apply')
  const db = getScoutDb()

  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)

  const stale = await db.interest.findMany({
    where: {
      isActive: true,
      OR: [
        { lastEngagedAt: null },
        { lastEngagedAt: { lt: cutoff } },
      ],
    },
    select: { id: true, topic: true, userId: true, score: true, lastEngagedAt: true },
  })

  console.log(`[interest-decay] ${stale.length} interests inactive for ≥14 days`)

  for (const interest of stale) {
    const newScore = Math.max(0.1, interest.score * 0.9)
    const lastEngaged = interest.lastEngagedAt?.toLocaleDateString() ?? 'never'
    console.log(`[interest-decay]   "${interest.topic}" ${interest.score.toFixed(2)} → ${newScore.toFixed(2)} (last: ${lastEngaged})`)

    if (apply) {
      await db.interest.update({
        where: { id: interest.id },
        data: { score: newScore },
      })
    }
  }

  if (!apply) {
    console.log('[interest-decay] Dry run — pass --apply to commit changes')
  } else {
    console.log('[interest-decay] Decay applied')
  }

  await disconnectAll()
}

main().catch(err => {
  console.error('[interest-decay] Fatal:', err)
  process.exit(1)
})
