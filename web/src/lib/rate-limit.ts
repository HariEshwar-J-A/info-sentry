/**
 * In-process rate limiter backed by a module-level Map.
 * Works in Next.js Route Handlers (Node.js runtime).
 *
 * Scalability path: replace RateLimiter with an @upstash/ratelimit adapter
 * when moving to multi-instance deployments — the call-site interface stays identical.
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Prune stale entries every 5 minutes to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key)
  }
}, 5 * 60 * 1000)

export interface RateLimitRule {
  /** Max requests per window */
  limit: number
  /** Window in seconds */
  windowSec: number
}

/**
 * Returns null if the request is allowed, or a 429 Response with Retry-After if blocked.
 * @param key  Unique identifier (e.g. `userId:route` or `ip:route`)
 */
export function checkRateLimit(key: string, rule: RateLimitRule): Response | null {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + rule.windowSec * 1000 })
    return null
  }

  if (entry.count >= rule.limit) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
    return new Response(
      JSON.stringify({ error: 'Too many requests', retryAfter }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(retryAfter),
        },
      }
    )
  }

  entry.count++
  return null
}

// ── Preset rules ─────────────────────────────────────────────────────────────

export const RATE_LIMITS = {
  chat:         { limit: 10, windowSec: 60 },
  articleChat:  { limit: 15, windowSec: 60 },
  pipelineRun:  { limit: 2,  windowSec: 300 },
  channelWrite: { limit: 5,  windowSec: 60 },
  interestWrite:{ limit: 10, windowSec: 60 },
  feedAiQuery:  { limit: 5,  windowSec: 60 },
  default:      { limit: 60, windowSec: 60 },
} as const
