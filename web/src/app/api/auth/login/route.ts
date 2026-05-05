import { cookies } from 'next/headers'
import { createToken } from '@/middleware'

export const runtime = 'edge'

export async function POST(req: Request) {
  const { username, password } = await req.json().catch(() => ({ username: '', password: '' })) as { username: string; password: string }

  const correctUser = process.env.WEB_AUTH_USERNAME
  const correctPass = process.env.WEB_AUTH_PASSWORD
  const secret      = process.env.WEB_AUTH_SECRET ?? 'dev-secret-change-me'

  // Fixed delay regardless of outcome — prevents timing-based enumeration
  await new Promise(r => setTimeout(r, 400))

  if (!correctUser || !correctPass || username !== correctUser || password !== correctPass) {
    return Response.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const token = await createToken(secret)
  const store = await cookies()
  store.set('is_auth', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 86_400,
    path: '/',
  })

  return Response.json({ ok: true })
}
