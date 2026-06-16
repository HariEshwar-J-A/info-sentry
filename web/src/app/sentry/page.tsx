import type { Metadata } from 'next'
import Link from 'next/link'
import { IDefinitionCycler } from '@/components/brand/IDefinitionCycler'
import { HarieshwarBadge }   from '@/components/brand/HarieshwarBadge'
import { AuroraBackground }  from '@/components/marketing/AuroraBackground'
import { ProductGrid }       from '@/components/marketing/ProductGrid'
import { ManifestoMarquee }  from '@/components/marketing/ManifestoMarquee'

export const metadata: Metadata = {
  title: 'infoSentry — Intelligence for everyone',
  description: 'A suite of AI-powered intelligence tools: iFeeds, iGitHub, iVideos, iChat, iSurprise. A Harieshwar J A initiative.',
}

export default function SentryHomePage() {
  return (
    <>
      {/* ── HERO ──────────────────────────────────────────────── */}
      <AuroraBackground intensity="strong" style={{ minHeight: '92vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px' }}>
        <div style={{ textAlign: 'center', maxWidth: 900, width: '100%' }}>
          <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'center' }}>
            <HarieshwarBadge href="https://harieshwar.dev" />
          </div>

          <IDefinitionCycler />

          <p style={{
            fontSize: 'clamp(16px, 2.2vw, 22px)',
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            marginTop: 32,
            marginBottom: 48,
            maxWidth: 620,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}>
            A suite of AI-powered tools that transform how you consume intelligence — news, code, video, conversation, and serendipity. One ecosystem. Five products. Your intelligence, amplified.
          </p>

          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link
              href="#products"
              style={{
                padding: '14px 32px',
                borderRadius: 10,
                fontSize: 16,
                fontWeight: 600,
                background: 'var(--violet-500)',
                color: '#fff',
                textDecoration: 'none',
                border: '1px solid var(--violet-400)',
                transition: 'background 150ms',
              }}
            >
              Explore the products
            </Link>
            <Link
              href="/sentry/manifesto"
              style={{
                padding: '14px 32px',
                borderRadius: 10,
                fontSize: 16,
                fontWeight: 600,
                background: 'transparent',
                color: 'var(--text-primary)',
                textDecoration: 'none',
                border: '1px solid var(--border-strong)',
                transition: 'border-color 150ms',
              }}
            >
              What does <em>i</em> mean?
            </Link>
          </div>

          {/* Scroll hint */}
          <div style={{ marginTop: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, opacity: 0.4 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Scroll</span>
            <div style={{
              width: 1,
              height: 48,
              background: 'linear-gradient(to bottom, var(--violet-400), transparent)',
              animation: 'fade-in 1s ease-out',
            }} />
          </div>
        </div>
      </AuroraBackground>

      {/* ── PRODUCT GRID ──────────────────────────────────────── */}
      <section id="products" aria-labelledby="products-heading" style={{ padding: '120px 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <h2
            id="products-heading"
            style={{
              fontFamily: 'Sora, sans-serif',
              fontSize: 'clamp(28px, 4vw, 48px)',
              fontWeight: 700,
              textAlign: 'center',
              color: 'var(--text-primary)',
              marginBottom: 16,
              letterSpacing: '-0.02em',
            }}
          >
            Five tools. One intelligence.
          </h2>
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 18, marginBottom: 64, maxWidth: 520, margin: '0 auto 64px' }}>
            Each product stands alone. Together they form an intelligence operating system.
          </p>
          <ProductGrid />
        </div>
      </section>

      {/* ── MANIFESTO MARQUEE ────────────────────────────────── */}
      <ManifestoMarquee />

      {/* ── FREE TIER CALLOUT ─────────────────────────────────── */}
      <section aria-labelledby="free-tier-heading" style={{ padding: '100px 24px', background: 'var(--bg-elevated)' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 16px',
            borderRadius: 999,
            background: 'rgba(139,92,246,0.12)',
            border: '1px solid var(--violet-700)',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--violet-300)',
            marginBottom: 24,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}>
            Free forever (up to $1/mo)
          </div>
          <h2
            id="free-tier-heading"
            style={{
              fontFamily: 'Sora, sans-serif',
              fontSize: 'clamp(28px, 4vw, 48px)',
              fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
              marginBottom: 20,
            }}
          >
            Intelligence, no credit card required.
          </h2>
          <p style={{ fontSize: 18, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 40 }}>
            Every product starts free. Use up to <strong style={{ color: 'var(--text-primary)' }}>$1 of AI compute</strong> per month across all products — no card, no catch. When paid plans launch, bundle them for a discount.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link
              href="/login"
              style={{
                padding: '14px 32px',
                borderRadius: 10,
                fontSize: 16,
                fontWeight: 600,
                background: 'var(--violet-500)',
                color: '#fff',
                textDecoration: 'none',
              }}
            >
              Start for free
            </Link>
            <Link
              href="/sentry/pricing"
              style={{
                padding: '14px 32px',
                borderRadius: 10,
                fontSize: 16,
                fontWeight: 500,
                color: 'var(--text-secondary)',
                textDecoration: 'none',
                border: '1px solid var(--border-strong)',
              }}
            >
              See upcoming plans
            </Link>
          </div>
        </div>
      </section>

      {/* ── ABOUT / MISSION ──────────────────────────────────── */}
      <section aria-labelledby="mission-heading" style={{ padding: '100px 24px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <h2
            id="mission-heading"
            style={{
              fontFamily: 'Sora, sans-serif',
              fontSize: 'clamp(24px, 3vw, 36px)',
              fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
              marginBottom: 24,
            }}
          >
            Built by one person, for everyone who thinks.
          </h2>
          <p style={{ fontSize: 17, color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: 24 }}>
            infoSentry is a <strong style={{ color: 'var(--text-primary)' }}>Harieshwar J A</strong> initiative. I built these tools because I wanted them to exist — and couldn't find anything that brought them together under one coherent design. The &ldquo;i&rdquo; in every product name isn't a nod to any corporation. It means what I want it to mean: intelligence, innovation, imagination. And increasingly, it means you.
          </p>
          <p style={{ fontSize: 17, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
            Each product is a standalone tool with a real paywall coming. The free tier is permanent. The vision is a growing arsenal — new &ldquo;i*&rdquo; products shipped as the toolkit grows.
          </p>
          <div style={{ marginTop: 40 }}>
            <HarieshwarBadge href="https://harieshwar.dev" />
          </div>
        </div>
      </section>
    </>
  )
}
