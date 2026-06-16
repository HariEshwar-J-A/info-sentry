'use client'

import React from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { AuroraBackground }     from '@/components/marketing/AuroraBackground'
import { IDefinitionCycler }    from '@/components/brand/IDefinitionCycler'
import { HarieshwarBadge }      from '@/components/brand/HarieshwarBadge'
import { TaglineStrip }         from '@/components/marketing/TaglineStrip'
import { FeatureGrid, Feature } from '@/components/marketing/FeatureGrid'
import { StatCounters, Stat }   from '@/components/marketing/StatCounters'
import { FAQ }                  from '@/components/marketing/FAQ'
import { CrossSell }            from '@/components/marketing/CrossSell'
import { ProductPricingCard }   from '@/components/marketing/ProductPricingCard'
import { MotionGate }           from '@/components/a11y/MotionGate'

type ThreeComponent = () => React.JSX.Element

interface CrossSellProduct {
  name: string
  tagline: string
  href: string
  accentColor: string
  icon: string
}

export interface ProductLandingConfig {
  product: string
  tagline: string
  taglineAccentWord?: string
  description: string
  heroWords: string[]
  accentColor: string
  icon: string
  features: Feature[]
  stats: Stat[]
  faq: { question: string; answer: string }[]
  threeScene: ThreeComponent
  staticFallbackAlt: string
  crossSell: CrossSellProduct[]
  freeTierNote: string
}

const SECTION_MAX = 1200

export function ProductLandingPage({ config }: { config: ProductLandingConfig }) {
  const {
    product, tagline, taglineAccentWord, description, heroWords,
    accentColor, icon, features, stats, faq, threeScene: ThreeScene,
    staticFallbackAlt, crossSell, freeTierNote,
  } = config

  const ThreeLazy = dynamic(() => Promise.resolve(ThreeScene).then(C => ({ default: C })), { ssr: false })

  const pricingTiers = [
    {
      name: 'Free',
      price: '$0',
      description: freeTierNote,
      features: ['No credit card needed', 'Up to $1/mo AI compute across all products', 'Core features included'],
      cta: 'Start for free',
      ctaHref: '/login',
      highlight: false,
    },
    {
      name: 'Pro',
      price: 'TBA',
      description: 'Unlimited usage, priority AI, no spend caps, and advanced features.',
      features: ['Unlimited usage', 'Priority AI models', 'Advanced features', 'Bundle discounts available'],
      cta: 'Join the waitlist',
      ctaHref: `/sentry/waitlist?product=${product}`,
      highlight: true,
      comingSoon: true,
    },
  ]

  return (
    <>
      {/* ── HERO ─────────────────────────────────────────────── */}
      <AuroraBackground intensity="strong">
        <div style={{
          maxWidth: SECTION_MAX,
          margin: '0 auto',
          padding: '80px 24px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 60,
          alignItems: 'center',
          minHeight: '85vh',
        }}>
          {/* Left */}
          <div>
            <div style={{ marginBottom: 24 }}>
              <HarieshwarBadge />
            </div>
            <div style={{ marginBottom: 24 }}>
              <IDefinitionCycler words={heroWords} prefix={product} fontSize="clamp(36px, 5vw, 72px)" />
            </div>
            <p style={{
              fontSize: 'clamp(15px, 1.8vw, 18px)',
              color: 'var(--text-secondary)',
              lineHeight: 1.7,
              marginBottom: 36,
              maxWidth: 500,
            }}>
              {description}
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link
                href="/login"
                style={{
                  padding: '12px 28px',
                  borderRadius: 9,
                  fontSize: 15,
                  fontWeight: 600,
                  background: accentColor,
                  color: '#0a0a14',
                  textDecoration: 'none',
                }}
              >
                Try {product} free
              </Link>
              <Link
                href={`/sentry/waitlist?product=${product}`}
                style={{
                  padding: '12px 28px',
                  borderRadius: 9,
                  fontSize: 15,
                  fontWeight: 500,
                  color: 'var(--text-secondary)',
                  textDecoration: 'none',
                  border: '1px solid var(--border-strong)',
                }}
              >
                Join Pro waitlist
              </Link>
            </div>
          </div>

          {/* Right — 3D scene */}
          <div
            style={{ height: 420, borderRadius: 20, overflow: 'hidden', background: 'rgba(22,22,54,0.4)', border: '1px solid var(--border)' }}
            aria-hidden="true"
          >
            <MotionGate
              motion={<ThreeLazy />}
              static={
                <div style={{
                  width: '100%', height: '100%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 80, opacity: 0.2,
                }}>
                  {icon}
                </div>
              }
            />
          </div>
        </div>
      </AuroraBackground>

      {/* ── TAGLINE ──────────────────────────────────────────── */}
      <div style={{ maxWidth: SECTION_MAX, margin: '0 auto', padding: '0 24px' }}>
        <TaglineStrip tagline={tagline} accentWord={taglineAccentWord} />
      </div>

      {/* ── FEATURES ─────────────────────────────────────────── */}
      <section aria-labelledby={`${product}-features`} style={{ padding: '80px 24px', background: 'var(--bg-elevated)' }}>
        <div style={{ maxWidth: SECTION_MAX, margin: '0 auto' }}>
          <h2
            id={`${product}-features`}
            style={{
              fontFamily: 'Sora, sans-serif',
              fontSize: 'clamp(22px, 3vw, 36px)',
              fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
              marginBottom: 40,
            }}
          >
            What {product} does
          </h2>
          <FeatureGrid features={features} />
        </div>
      </section>

      {/* ── STATS ────────────────────────────────────────────── */}
      <section aria-labelledby={`${product}-stats`} style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: SECTION_MAX, margin: '0 auto' }}>
          <StatCounters stats={stats} />
        </div>
      </section>

      {/* ── PRICING ──────────────────────────────────────────── */}
      <section style={{ padding: '0 24px 80px', background: 'var(--bg-elevated)' }}>
        <div style={{ maxWidth: SECTION_MAX, margin: '0 auto' }}>
          <ProductPricingCard product={product} tiers={pricingTiers} />
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────── */}
      <section style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <FAQ items={faq} />
        </div>
      </section>

      {/* ── CROSS-SELL ───────────────────────────────────────── */}
      <section style={{ padding: '0 24px 100px' }}>
        <div style={{ maxWidth: SECTION_MAX, margin: '0 auto' }}>
          <CrossSell current={product} products={crossSell} />
        </div>
      </section>
    </>
  )
}
