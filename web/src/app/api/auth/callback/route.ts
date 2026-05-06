import { NextResponse } from 'next/server'
import { createToken } from '@/middleware'
import { prisma } from '@/lib/prisma'

interface GoogleToken { access_token: string }
interface GoogleUser  { id: string; email: string; name: string; picture: string }

export async function GET(req: Request) {
  const url    = new URL(req.url)
  const appUrl =
    process.env.APP_URL ??
    `${url.protocol}//${url.host}`
  const isSecure = appUrl.startsWith('https://')
  const code   = url.searchParams.get('code')
  const state  = url.searchParams.get('state')
  const error  = url.searchParams.get('error')

  if (error || !code || !state) {
    return NextResponse.redirect(`${appUrl}/login?error=oauth_denied`)
  }

  // CSRF: verify signed state (no cookies required)
  const secret = process.env.WEB_AUTH_SECRET ?? 'dev-secret-change-me'
  const okState = await verifySignedState(state, secret)
  if (!okState) return NextResponse.redirect(`${appUrl}/login?error=state_mismatch`)

  // Exchange code → access token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri:  `${appUrl}/api/auth/callback`,
      grant_type:    'authorization_code',
    }),
  })

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${appUrl}/login?error=token_exchange`)
  }

  const { access_token } = (await tokenRes.json()) as GoogleToken

  // Fetch user profile
  const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${access_token}` },
  })

  if (!userRes.ok) {
    return NextResponse.redirect(`${appUrl}/login?error=userinfo`)
  }

  const user = (await userRes.json()) as GoogleUser

  // Secondary allowlist (optional).
  // When empty/unset: do not block anyone (Google Console test-users are the primary gate).
  // When set: only allow those emails.
  const allowed = (process.env.ALLOWED_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  if (allowed.length > 0 && !allowed.includes(user.email.toLowerCase())) {
    return NextResponse.redirect(`${appUrl}/login/unauthorized`)
  }

  const dbUser = await prisma.user.upsert({
    where:  { googleSub: user.id },
    update: {
      email:   user.email,
      name:    user.name,
      picture: user.picture,
    },
    create: {
      googleSub: user.id,
      email:     user.email,
      name:      user.name,
      picture:   user.picture,
    },
  })

  // Issue session cookie (embeds Prisma user id)
  const token  = await createToken(secret, dbUser.id)

  // Set cookie on the response so it is guaranteed to stick
  const res = NextResponse.redirect(`${appUrl}/`)
  res.cookies.set('is_auth', token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    maxAge: 30 * 86_400,
    path: '/',
  })
  return res
}

async function verifySignedState(state: string, secret: string): Promise<boolean> {
  const parts = state.split('.')
  if (parts.length < 3) return false
  const sig = parts[parts.length - 1]!
  const payload = parts.slice(0, -1).join('.')
  const expected = await hmacHex(secret, payload)
  if (expected !== sig) return false
  const tsStr = payload.split('.', 1)[0]!
  const ts = Number(tsStr)
  if (!Number.isFinite(ts)) return false
  // 10 minute expiry
  return Date.now() - ts < 10 * 60 * 1000
}

async function hmacHex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const buf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}
