import { NextRequest, NextResponse } from 'next/server'

const SESSION_COOKIE = 'is_auth'
const SESSION_DAYS   = 30
const USER_ID_HEADER = 'x-user-id'

// Paths that bypass auth entirely
const PUBLIC_PREFIXES = ['/login', '/api/auth']

export type VerifyTokenResult =
  | { valid: true; userId: string }
  | { valid: false }

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) return NextResponse.next()

  // If session secret is not configured, bypass auth (local dev / first run)
  // Using WEB_AUTH_SECRET here avoids accidental bypass when oauth env is present
  // but legacy username/password vars are not set in web/.env.local.
  if (!process.env.WEB_AUTH_SECRET) return NextResponse.next()

  const token  = request.cookies.get(SESSION_COOKIE)?.value
  const secret = process.env.WEB_AUTH_SECRET ?? 'dev-secret-change-me'

  const verified = token ? await verifyToken(token, secret) : { valid: false as const }
  if (!verified.valid) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    if (pathname !== '/') url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(USER_ID_HEADER, verified.userId)

  return NextResponse.next({
    request: { headers: requestHeaders },
  })
}

export const config = {
  // Skip Next.js internals and static files
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons/).*)'],
}

// ── Token helpers (Web Crypto — Edge runtime compatible) ──────────────────

export async function createToken(secret: string, userId: string): Promise<string> {
  const exp = Date.now() + SESSION_DAYS * 86_400_000
  const payload = `${userId}:${exp}`
  const sig  = await hmacHex(secret, payload)
  return `${userId}.${exp}.${sig}`
}

export async function verifyToken(token: string, secret: string): Promise<VerifyTokenResult> {
  const parts = token.split('.')
  if (parts.length < 3) return { valid: false }
  const sig = parts[parts.length - 1]!
  const expStr = parts[parts.length - 2]!
  const userId = parts.slice(0, -2).join('.')
  if (!userId || !expStr) return { valid: false }
  const exp = parseInt(expStr, 10)
  if (isNaN(exp) || exp < Date.now()) return { valid: false }
  const payload = `${userId}:${exp}`
  const expected = await hmacHex(secret, payload)
  if (expected !== sig) return { valid: false }
  return { valid: true, userId }
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
