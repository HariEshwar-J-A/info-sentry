import type { Metadata } from 'next'
import Link from 'next/link'
import { InfoSentryLogo } from '@/components/shell/InfoSentryLogo'

export const metadata: Metadata = {
  title: { template: '%s — infoSentry', default: 'infoSentry' },
  description: 'Intelligence, innovation, insight — a Harieshwar J A initiative',
}

const NAV_PRODUCTS = [
  { href: '/sentry/iFeeds',    label: 'iFeeds' },
  { href: '/sentry/iGitHub',   label: 'iGitHub' },
  { href: '/sentry/iVideos',   label: 'iVideos' },
  { href: '/sentry/iChat',     label: 'iChat' },
  { href: '/sentry/iSurprise', label: 'iSurprise' },
]

export default function SentryMarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%', background: 'var(--bg)' }}>
      {/* Sticky marketing nav */}
      <header
        role="banner"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          borderBottom: '1px solid var(--border)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          background: 'rgba(10,10,20,0.85)',
        }}
      >
        <div style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '0 24px',
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}>
          {/* Logo + tagline */}
          <Link href="/sentry" aria-label="infoSentry home" style={{ textDecoration: 'none' }}>
            <InfoSentryLogo variant="wordmark" size={32} />
          </Link>

          {/* Product links */}
          <nav aria-label="Products" style={{ display: 'flex', gap: 4 }}>
            {NAV_PRODUCTS.map(p => (
              <Link
                key={p.href}
                href={p.href}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 500,
                  color: 'var(--text-secondary)',
                  textDecoration: 'none',
                  transition: 'color 150ms, background 150ms',
                }}
                className="hover:text-[var(--text-primary)] hover:bg-[var(--hover)]"
              >
                {p.label}
              </Link>
            ))}
          </nav>

          {/* CTA */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Link
              href="/sentry/pricing"
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                fontSize: 14,
                fontWeight: 500,
                color: 'var(--text-secondary)',
                textDecoration: 'none',
              }}
            >
              Pricing
            </Link>
            <Link
              href="/login"
              style={{
                padding: '8px 18px',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                background: 'var(--violet-500)',
                color: '#fff',
                textDecoration: 'none',
                transition: 'background 150ms',
              }}
              className="hover:bg-[var(--violet-600)]"
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main id="main" style={{ flex: 1 }}>
        {children}
      </main>

      {/* Footer */}
      <footer
        role="contentinfo"
        style={{
          borderTop: '1px solid var(--border)',
          padding: '48px 24px 32px',
          background: 'var(--bg-elevated)',
        }}
      >
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 40,
            marginBottom: 48,
          }}>
            <div>
              <InfoSentryLogo variant="wordmark" size={26} tagline />
            </div>
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Products</p>
              {NAV_PRODUCTS.map(p => (
                <Link key={p.href} href={p.href} style={{ display: 'block', fontSize: 14, color: 'var(--text-secondary)', textDecoration: 'none', marginBottom: 8 }}>
                  {p.label}
                </Link>
              ))}
            </div>
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Company</p>
              <Link href="/sentry/manifesto" style={{ display: 'block', fontSize: 14, color: 'var(--text-secondary)', textDecoration: 'none', marginBottom: 8 }}>Manifesto</Link>
              <Link href="/sentry/pricing"   style={{ display: 'block', fontSize: 14, color: 'var(--text-secondary)', textDecoration: 'none', marginBottom: 8 }}>Pricing</Link>
              <Link href="/sentry/waitlist"  style={{ display: 'block', fontSize: 14, color: 'var(--text-secondary)', textDecoration: 'none', marginBottom: 8 }}>Waitlist</Link>
            </div>
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>App</p>
              <Link href="/iFeeds"    style={{ display: 'block', fontSize: 14, color: 'var(--text-secondary)', textDecoration: 'none', marginBottom: 8 }}>Dashboard</Link>
              <Link href="/login"     style={{ display: 'block', fontSize: 14, color: 'var(--text-secondary)', textDecoration: 'none', marginBottom: 8 }}>Sign in</Link>
            </div>
          </div>
          <div style={{
            borderTop: '1px solid var(--border)',
            paddingTop: 24,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
              © {new Date().getFullYear()} infoSentry — a Harieshwar J A initiative
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
              Intelligence beyond the obvious
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
