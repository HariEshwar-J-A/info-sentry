import type { Metadata } from 'next'
import { BundleConfigurator } from '@/components/marketing/BundleConfigurator'
import { AuroraBackground }   from '@/components/marketing/AuroraBackground'

export const metadata: Metadata = {
  title: 'Pricing — infoSentry',
  description: 'Free forever up to $1/mo of AI compute. Bundle products for upcoming paid plans with discounts.',
}

export default function PricingPage() {
  return (
    <>
      <AuroraBackground intensity="medium">
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '100px 24px 60px', textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex',
            padding: '5px 16px',
            borderRadius: 999,
            background: 'rgba(139,92,246,0.12)',
            border: '1px solid var(--violet-700)',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--violet-300)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: 24,
          }}>
            Paid plans coming soon
          </div>
          <h1 style={{
            fontFamily: 'Sora, sans-serif',
            fontSize: 'clamp(32px, 5vw, 60px)',
            fontWeight: 800,
            color: 'var(--text-primary)',
            letterSpacing: '-0.03em',
            marginBottom: 20,
          }}>
            Simple pricing. Real value.
          </h1>
          <p style={{ fontSize: 18, color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: 560, margin: '0 auto 60px' }}>
            Start free — up to $1/mo of AI compute across all products, no card required. Bundle products for upcoming paid plans with meaningful discounts.
          </p>
        </div>
      </AuroraBackground>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '60px 24px 100px' }}>
        <h2 style={{
          fontFamily: 'Sora, sans-serif',
          fontSize: 28,
          fontWeight: 700,
          color: 'var(--text-primary)',
          letterSpacing: '-0.02em',
          marginBottom: 8,
        }}>
          Configure your bundle
        </h2>
        <p style={{ fontSize: 15, color: 'var(--text-muted)', marginBottom: 32 }}>
          Select the products you want. More products = bigger discount. Prices shown are illustrative — final pricing at launch.
        </p>
        <BundleConfigurator />

        <div style={{ marginTop: 64, padding: 28, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)' }}>
          <h3 style={{ fontFamily: 'Sora, sans-serif', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>
            Always free, forever
          </h3>
          <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 0 }}>
            Every product is free to use up to a combined $1/month of AI compute. No credit card needed. The free tier is permanent — paid plans add capacity and advanced features, not different access.
          </p>
        </div>
      </div>
    </>
  )
}
