'use client'

import { motion } from 'framer-motion'
import { useInView } from 'framer-motion'
import { useRef } from 'react'
import { MotionGate } from '@/components/a11y/MotionGate'

export interface Feature {
  icon: string
  title: string
  description: string
  accent?: string
}

interface Props {
  features: Feature[]
  columns?: 2 | 3
}

function FeatureTile({ feature, index, accent = 'var(--violet-400)' }: { feature: Feature; index: number; accent?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
      style={{
        padding: 24,
        borderRadius: 12,
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        transition: 'border-color 200ms',
      }}
    >
      <div style={{ fontSize: 28, marginBottom: 14, lineHeight: 1 }}>{feature.icon}</div>
      <h3 style={{
        fontSize: 16,
        fontWeight: 600,
        color: 'var(--text-primary)',
        marginBottom: 8,
        letterSpacing: '-0.01em',
      }}>{feature.title}</h3>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65 }}>{feature.description}</p>
    </motion.div>
  )
}

function StaticTile({ feature }: { feature: Feature }) {
  return (
    <div style={{
      padding: 24,
      borderRadius: 12,
      border: '1px solid var(--border)',
      background: 'var(--surface)',
    }}>
      <div style={{ fontSize: 28, marginBottom: 14, lineHeight: 1 }}>{feature.icon}</div>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>{feature.title}</h3>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65 }}>{feature.description}</p>
    </div>
  )
}

export function FeatureGrid({ features, columns = 3 }: Props) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill, minmax(${columns === 3 ? 260 : 320}px, 1fr))`,
        gap: 16,
      }}
    >
      {features.map((feature, i) => (
        <MotionGate
          key={feature.title}
          motion={<FeatureTile feature={feature} index={i} />}
          static={<StaticTile feature={feature} />}
        />
      ))}
    </div>
  )
}
