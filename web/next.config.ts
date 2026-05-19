import type { NextConfig } from 'next'

const basePath = process.env.BASE_PATH ?? ''

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
]

// HTML pages must never be cached — stale HTML references old JS chunk hashes
// which no longer exist after a rebuild, causing 400 / MIME-type errors.
const noCacheHeaders = [
  { key: 'Cache-Control', value: 'no-store, must-revalidate' },
  { key: 'Pragma', value: 'no-cache' },
]

const nextConfig: NextConfig = {
  serverExternalPackages: ['@prisma/client', 'prisma'],
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
  async headers() {
    return [
      // Security headers on everything
      { source: '/(.*)', headers: securityHeaders },
      // Never cache HTML navigation responses (prevents stale-chunk 400s after rebuild)
      { source: '/((?!_next/static|_next/image|favicon.ico|icon-|badge-|manifest|sw.js).*)', headers: noCacheHeaders },
    ]
  },
}

export default nextConfig
