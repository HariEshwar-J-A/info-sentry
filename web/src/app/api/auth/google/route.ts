import { cookies } from 'next/headers'

export async function GET() {
  const clientId  = process.env.GOOGLE_CLIENT_ID
  const appUrl    = process.env.APP_URL ?? 'https://sentry.harieshwar.dev'

  if (!clientId) {
    return Response.json({ error: 'GOOGLE_CLIENT_ID not configured' }, { status: 500 })
  }

  const state = crypto.randomUUID()
  const store = await cookies()
  store.set('oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,   // 10 minute window to complete OAuth
    path: '/',
  })

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  `${appUrl}/api/auth/callback`,
    response_type: 'code',
    scope:         'email profile',
    state,
    access_type:   'online',
    prompt:        'select_account',
  })

  return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
}
