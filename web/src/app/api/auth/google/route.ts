export async function GET(req: Request) {
  const clientId  = process.env.GOOGLE_CLIENT_ID
  const requestUrl = new URL(req.url)
  const appUrl =
    process.env.APP_URL ??
    `${requestUrl.protocol}//${requestUrl.host}`

  if (!clientId) {
    return Response.json({ error: 'GOOGLE_CLIENT_ID not configured' }, { status: 500 })
  }

  // Self-contained, signed state (no cookies).
  // Cookie-based state is fragile (SameSite / multi-tab / account switching).
  const secret = process.env.WEB_AUTH_SECRET ?? 'dev-secret-change-me'
  const now = Date.now()
  const nonce = crypto.randomUUID()
  const payload = `${now}.${nonce}`
  const sig = await hmacHex(secret, payload)
  const state = `${payload}.${sig}`

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
