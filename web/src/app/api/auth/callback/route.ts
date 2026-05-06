import { cookies } from 'next/headers'
import { createToken } from '@/middleware'

const UNAUTHORIZED_REDIRECT = 'https://harieshwar.dev'

interface GoogleToken { access_token: string }
interface GoogleUser  { email: string; name: string; picture: string }

export async function GET(req: Request) {
  const url    = new URL(req.url)
  const appUrl = process.env.APP_URL ?? 'https://sentry.harieshwar.dev'
  const code   = url.searchParams.get('code')
  const state  = url.searchParams.get('state')
  const error  = url.searchParams.get('error')

  if (error || !code || !state) {
    return Response.redirect(`${appUrl}/login?error=oauth_denied`)
  }

  // CSRF: verify state matches what we set in the /google route
  const store      = await cookies()
  const savedState = store.get('oauth_state')?.value
  store.delete('oauth_state')

  if (!savedState || savedState !== state) {
    return Response.redirect(`${appUrl}/login?error=state_mismatch`)
  }

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
    return Response.redirect(`${appUrl}/login?error=token_exchange`)
  }

  const { access_token } = (await tokenRes.json()) as GoogleToken

  // Fetch user profile
  const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${access_token}` },
  })

  if (!userRes.ok) {
    return Response.redirect(`${appUrl}/login?error=userinfo`)
  }

  const user = (await userRes.json()) as GoogleUser

  // Check allowlist — comma-separated emails in ALLOWED_EMAILS env var
  const allowed = (process.env.ALLOWED_EMAILS ?? '')
    .split(',').map(e => e.trim().toLowerCase()).filter(Boolean)

  if (!allowed.includes(user.email.toLowerCase())) {
    return Response.redirect(UNAUTHORIZED_REDIRECT)
  }

  // Issue session cookie
  const secret = process.env.WEB_AUTH_SECRET ?? 'dev-secret-change-me'
  const token  = await createToken(secret)

  store.set('is_auth', token, {
    httpOnly: true,
    secure:   true,
    sameSite: 'lax',
    maxAge:   30 * 86_400,
    path:     '/',
  })

  return Response.redirect(`${appUrl}/`)
}
