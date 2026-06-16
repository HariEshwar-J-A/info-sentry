import Link from 'next/link'

interface PricingTier {
  name: string
  price: string
  description: string
  features: string[]
  cta: string
  ctaHref: string
  highlight?: boolean
  comingSoon?: boolean
}

interface Props {
  product: string
  tiers: PricingTier[]
}

export function ProductPricingCard({ product, tiers }: Props) {
  return (
    <section aria-labelledby={`pricing-${product}`} style={{ marginTop: 80 }}>
      <h2
        id={`pricing-${product}`}
        style={{
          fontFamily: 'Sora, sans-serif',
          fontSize: 'clamp(22px, 3vw, 36px)',
          fontWeight: 700,
          color: 'var(--text-primary)',
          letterSpacing: '-0.02em',
          marginBottom: 32,
        }}
      >
        Pricing
      </h2>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 20,
      }}>
        {tiers.map(tier => (
          <div
            key={tier.name}
            style={{
              padding: 28,
              borderRadius: 16,
              border: tier.highlight
                ? '1px solid var(--violet-500)'
                : '1px solid var(--border)',
              background: tier.highlight
                ? 'linear-gradient(135deg, rgba(139,92,246,0.12) 0%, var(--surface) 100%)'
                : 'var(--surface)',
              display: 'flex',
              flexDirection: 'column',
              gap: 0,
              position: 'relative',
            }}
          >
            {tier.comingSoon && (
              <div style={{
                position: 'absolute',
                top: 16, right: 16,
                padding: '3px 10px',
                borderRadius: 999,
                background: 'rgba(139,92,246,0.15)',
                border: '1px solid var(--violet-700)',
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--violet-300)',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}>
                Coming soon
              </div>
            )}
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              {tier.name}
            </p>
            <p style={{
              fontFamily: 'Sora, sans-serif',
              fontSize: 40,
              fontWeight: 800,
              color: 'var(--text-primary)',
              letterSpacing: '-0.03em',
              lineHeight: 1,
              marginBottom: 8,
            }}>
              {tier.price}
            </p>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.5 }}>{tier.description}</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
              {tier.features.map(f => (
                <li key={f} style={{ display: 'flex', gap: 10, fontSize: 14, color: 'var(--text-secondary)', alignItems: 'flex-start' }}>
                  <span style={{ color: 'var(--positive)', flexShrink: 0, marginTop: 1 }}>✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href={tier.ctaHref}
              style={{
                display: 'block',
                textAlign: 'center',
                padding: '11px 24px',
                borderRadius: 9,
                fontSize: 14,
                fontWeight: 600,
                textDecoration: 'none',
                background: tier.highlight ? 'var(--violet-500)' : 'transparent',
                color: tier.highlight ? '#fff' : 'var(--text-secondary)',
                border: tier.highlight ? '1px solid var(--violet-400)' : '1px solid var(--border-strong)',
                opacity: tier.comingSoon ? 0.6 : 1,
                pointerEvents: tier.comingSoon ? 'none' : 'auto',
              }}
              aria-disabled={tier.comingSoon}
              aria-label={tier.comingSoon ? `${tier.cta} — coming soon` : tier.cta}
            >
              {tier.cta}
            </Link>
          </div>
        ))}
      </div>
    </section>
  )
}
