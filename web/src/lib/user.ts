import { getSessionUserId } from '@/lib/session'

/**
 * For API route handlers: reads userId from the `is_auth` cookie directly.
 * Returns { userId } or a 401 Response.
 * Use: const auth = await requireUserId(); if (auth instanceof Response) return auth
 */
export async function requireUserId(): Promise<{ userId: string } | Response> {
  const id = await getSessionUserId()
  if (!id) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  return { userId: id }
}

/**
 * For server components: reads userId from the `is_auth` cookie.
 * Returns null if not authenticated.
 */
export async function getUserId(): Promise<string | null> {
  return getSessionUserId()
}
