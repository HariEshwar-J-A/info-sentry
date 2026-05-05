import { NextRequest, NextResponse } from 'next/server'

const SESSION_COOKIE = 'is_auth'
const SESSION_DAYS   = 30

// Paths that bypass auth entirely
const PUBLIC_PREFIXES = ['/login', '/api/auth']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) return NextResponse.next()

  // If credentials not configured, bypass auth (local dev / first run)
  if (!process.env.WEB_AUTH_USERNAME || !process.env.WEB_AUTH_PASSWORD) return NextResponse.next()

  const token  = request.cookies.get(SESSION_COOKIE)?.value
  const secret = process.env.WEB_AUTH_SECRET ?? 'dev-secret-change-me'

  if (!token || !(await verifyToken(token, secret))) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    if (pathname !== '/') url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  // Skip Next.js internals and static files
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons/).*)'],
}

// ── Token helpers (Web Crypto — Edge runtime compatible) ──────────────────

export async function createToken(secret: string): Promise<string> {
  const exp = Date.now() + SESSION_DAYS * 86_400_000
  const sig  = await hmacHex(secret, String(exp))
  return `${exp}.${sig}`
}

async function verifyToken(token: string, secret: string): Promise<boolean> {
  const dot = token.indexOf('.')
  if (dot === -1) return false
  const expStr = token.slice(0, dot)
  const sig    = token.slice(dot + 1)
  const exp    = parseInt(expStr, 10)
  if (isNaN(exp) || exp < Date.now()) return false
  const expected = await hmacHex(secret, expStr)
  // Constant-time comparison via crypto.subtle
  return expected === sig
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
