import type { NextConfig } from 'next'

// Set BASE_PATH env var to enable path-based hosting, e.g. BASE_PATH=/sentry
// Leave unset for subdomain or local development (served at /)
const basePath = process.env.BASE_PATH ?? ''

// Next.js 15 requires 'unsafe-inline' + 'unsafe-eval' for its runtime.
// Future: switch to nonce-based CSP once on a stable Next.js release that
// supports nonce injection without patching _document.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' blob: data: https:",
  "connect-src 'self' https://oauth2.googleapis.com https://accounts.google.com https://cloudflareinsights.com",
  "font-src 'self' https://fonts.gstatic.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy',   value: CSP },
  { key: 'X-Frame-Options',           value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options',    value: 'nosniff' },
  { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-XSS-Protection',          value: '1; mode=block' },
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
