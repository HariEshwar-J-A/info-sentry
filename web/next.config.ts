import type { NextConfig } from 'next'

// Set BASE_PATH env var to enable path-based hosting, e.g. BASE_PATH=/sentry
// Leave unset for subdomain or local development (served at /)
const basePath = process.env.BASE_PATH ?? ''

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
]

const nextConfig: NextConfig = {
  serverExternalPackages: ['@prisma/client', 'prisma'],
  // basePath makes the app serve from /sentry instead of / when set
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }]
  },
}

export default nextConfig
