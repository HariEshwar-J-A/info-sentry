'use client'

import Link from 'next/link'
import { motion, useMotionValue, useTransform, useSpring } from 'framer-motion'
import { useRef } from 'react'
import { MotionGate } from '@/components/a11y/MotionGate'

const PRODUCTS = [
  {
    slug: 'iFeeds',
    name: 'iFeeds',
    tagline: 'Read less. Understand more.',
    desc: 'AI-curated news ranked by relevance to your topics. No noise. Pure intelligence.',
    accent: '#c084fc',
    icon: '◈',
    href: '/sentry/iFeeds',
  },
  {
    slug: 'iGitHub',
    name: 'iGitHub',
    tagline: 'The pulse of open source.',
    desc: 'Trending repos, filtered and ranked for what you care about. The tech pulse, daily.',
    accent: '#a78bfa',
    icon: '⬡',
    href: '/sentry/iGitHub',
  },
  {
    slug: 'iVideos',
    name: 'iVideos',
    tagline: 'Channels you trust. On demand.',
    desc: 'Subscribed YouTube channels with AI transcripts and summaries — no scrolling required.',
    accent: '#818cf8',
    icon: '▷',
    href: '/sentry/iVideos',
  },
  {
    slug: 'iChat',
    name: 'iChat',
    tagline: 'Your context. In conversation.',
    desc: 'AI chat grounded in your feeds, code, and context. Not generic. Specifically yours.',
    accent: '#e879f9',
    icon: '◌',
    href: '/sentry/iChat',
  },
  {
    slug: 'iSurprise',
    name: 'iSurprise',
    tagline: 'Twelve things you weren\'t looking for.',
    desc: 'High-quality content beyond your usual interests. Engineered serendipity.',
    accent: '#f0abfc',
    icon: '✦',
    href: '/sentry/iSurprise',
  },
]

function TiltCard({ product }: { product: typeof PRODUCTS[0] }) {
  const ref = useRef<HTMLDivElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const springX = useSpring(x, { stiffness: 200, damping: 20 })
  const springY = useSpring(y, { stiffness: 200, damping: 20 })
  const rotateX = useTransform(springY, [-0.5, 0.5], [8, -8])
  const rotateY = useTransform(springX, [-0.5, 0.5], [-8, 8])

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    x.set((e.clientX - rect.left) / rect.width - 0.5)
    y.set((e.clientY - rect.top) / rect.height - 0.5)
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={() => { x.set(0); y.set(0) }}
      style={{ rotateX, rotateY, transformStyle: 'preserve-3d', perspective: 800 }}
      whileHover={{ scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      <Link
        href={product.href}
        style={{
          display: 'block',
          padding: 28,
          borderRadius: 16,
          border: `1px solid rgba(${hexToRgb(product.accent)}, 0.25)`,
          background: `linear-gradient(135deg, rgba(${hexToRgb(product.accent)}, 0.06) 0%, rgba(22,22,54,0.8) 100%)`,
          textDecoration: 'none',
          position: 'relative',
          overflow: 'hidden',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          transition: 'border-color 250ms',
        }}
        aria-label={`Learn about ${product.name} — ${product.tagline}`}
      >
        {/* Spotlight */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: 1,
          background: `linear-gradient(90deg, transparent, ${product.accent}66, transparent)`,
        }} />

        <div style={{ fontSize: 28, marginBottom: 16, color: product.accent }}>{product.icon}</div>
        <h3 style={{
          fontFamily: 'Sora, sans-serif',
          fontSize: 22,
          fontWeight: 700,
          color: 'var(--text-primary)',
          letterSpacing: '-0.02em',
          marginBottom: 8,
        }}>{product.name}</h3>
        <p style={{ fontSize: 13, fontWeight: 600, color: product.accent, marginBottom: 12 }}>{product.tagline}</p>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{product.desc}</p>
        <div style={{
          marginTop: 20,
          fontSize: 13,
          fontWeight: 600,
          color: product.accent,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          Explore →
        </div>
      </Link>
    </motion.div>
  )
}

function StaticCard({ product }: { product: typeof PRODUCTS[0] }) {
  return (
    <Link
      href={product.href}
      style={{
        display: 'block',
        padding: 28,
        borderRadius: 16,
        border: `1px solid rgba(${hexToRgb(product.accent)}, 0.25)`,
        background: `linear-gradient(135deg, rgba(${hexToRgb(product.accent)}, 0.06) 0%, rgba(22,22,54,0.8) 100%)`,
        textDecoration: 'none',
      }}
      aria-label={`Learn about ${product.name} — ${product.tagline}`}
    >
      <div style={{ fontSize: 28, marginBottom: 16, color: product.accent }}>{product.icon}</div>
      <h3 style={{ fontFamily: 'Sora, sans-serif', fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 8 }}>{product.name}</h3>
      <p style={{ fontSize: 13, fontWeight: 600, color: product.accent, marginBottom: 12 }}>{product.tagline}</p>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{product.desc}</p>
      <div style={{ marginTop: 20, fontSize: 13, fontWeight: 600, color: product.accent }}>Explore →</div>
    </Link>
  )
}

function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return '139,92,246'
  return `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}`
}

export function ProductGrid() {
  return (
    <div
      role="list"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: 20,
      }}
    >
      {PRODUCTS.map(product => (
        <div key={product.slug} role="listitem">
          <MotionGate
            motion={<TiltCard product={product} />}
            static={<StaticCard product={product} />}
          />
        </div>
      ))}
    </div>
  )
}
