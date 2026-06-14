/**
 * Server-side session helper.
 * Reads and verifies the `is_auth` cookie directly — does NOT rely on
 * middleware forwarding `x-user-id` as a request header (unreliable in
 * Next.js 15 production mode for API route handlers).
 */
import { cookies } from 'next/headers'
import { verifyToken } from '@/middleware'

const SESSION_COOKIE = 'is_auth'

export async function getSessionUserId(): Promise<string | null> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (!token) return null
  const secret = process.env.WEB_AUTH_SECRET
  if (!secret) return null
  const result = await verifyToken(token, secret)
  return result.valid ? result.userId : null
}
