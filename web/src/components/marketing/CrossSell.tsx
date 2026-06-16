import Link from 'next/link'

interface CrossSellProduct {
  name: string
  tagline: string
  href: string
  accentColor: string
  icon: string
}

interface Props {
  current: string
  products: CrossSellProduct[]
}

export function CrossSell({ current, products }: Props) {
  return (
    <section aria-labelledby="crosssell-heading" style={{ marginTop: 80 }}>
      <h2
        id="crosssell-heading"
        style={{
          fontFamily: 'Sora, sans-serif',
          fontSize: 22,
          fontWeight: 700,
          color: 'var(--text-primary)',
          letterSpacing: '-0.02em',
          marginBottom: 20,
        }}
      >
        Pairs well with
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        {products.map(p => (
          <Link
            key={p.name}
            href={p.href}
            style={{
              display: 'block',
              padding: '20px 24px',
              borderRadius: 12,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              textDecoration: 'none',
              transition: 'border-color 200ms, background 200ms',
            }}
            aria-label={`Explore ${p.name} — ${p.tagline}`}
          >
            <div style={{ fontSize: 22, marginBottom: 10 }}>{p.icon}</div>
            <p style={{ fontSize: 15, fontWeight: 600, color: p.accentColor, marginBottom: 6 }}>{p.name}</p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{p.tagline}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}
