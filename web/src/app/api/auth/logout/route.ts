import { cookies } from 'next/headers'

export const runtime = 'edge'

export async function POST() {
  const store = await cookies()
  store.delete('is_auth')
  return Response.json({ ok: true })
}
