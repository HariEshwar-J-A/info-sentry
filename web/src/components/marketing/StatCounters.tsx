'use client'

import { motion, useInView, useMotionValue, useTransform, animate } from 'framer-motion'
import { useRef, useEffect } from 'react'
import { MotionGate } from '@/components/a11y/MotionGate'

export interface Stat {
  value: number
  suffix?: string
  prefix?: string
  label: string
}

function AnimatedNumber({ value, suffix = '', prefix = '' }: { value: number; suffix?: string; prefix?: string }) {
  const count = useMotionValue(0)
  const rounded = useTransform(count, v => `${prefix}${Math.round(v).toLocaleString()}${suffix}`)
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })

  useEffect(() => {
    if (inView) {
      const controls = animate(count, value, { duration: 1.8, ease: 'easeOut' })
      return controls.stop
    }
  }, [inView, count, value])

  return <motion.span ref={ref}>{rounded}</motion.span>
}

function CounterRow({ stats }: { stats: Stat[] }) {
  return (
    <div style={{
      display: 'flex',
      gap: 0,
      justifyContent: 'center',
      flexWrap: 'wrap',
    }}>
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          style={{
            flex: '1 1 180px',
            textAlign: 'center',
            padding: '32px 24px',
            borderRight: i < stats.length - 1 ? '1px solid var(--border)' : 'none',
          }}
        >
          <div style={{
            fontFamily: 'Sora, sans-serif',
            fontSize: 'clamp(36px, 5vw, 64px)',
            fontWeight: 800,
            color: 'var(--violet-300)',
            letterSpacing: '-0.03em',
            lineHeight: 1,
            marginBottom: 10,
          }}>
            <AnimatedNumber value={stat.value} suffix={stat.suffix} prefix={stat.prefix} />
          </div>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>{stat.label}</p>
        </div>
      ))}
    </div>
  )
}

function StaticRow({ stats }: { stats: Stat[] }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap' }}>
      {stats.map((stat, i) => (
        <div key={stat.label} style={{
          flex: '1 1 180px',
          textAlign: 'center',
          padding: '32px 24px',
          borderRight: i < stats.length - 1 ? '1px solid var(--border)' : 'none',
        }}>
          <div style={{
            fontFamily: 'Sora, sans-serif',
            fontSize: 'clamp(36px, 5vw, 64px)',
            fontWeight: 800,
            color: 'var(--violet-300)',
            letterSpacing: '-0.03em',
            lineHeight: 1,
            marginBottom: 10,
          }}>
            {stat.prefix}{stat.value.toLocaleString()}{stat.suffix}
          </div>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>{stat.label}</p>
        </div>
      ))}
    </div>
  )
}

export function StatCounters({ stats }: { stats: Stat[] }) {
  return (
    <div style={{
      borderRadius: 16,
      border: '1px solid var(--border)',
      background: 'var(--surface)',
      overflow: 'hidden',
    }}>
      <MotionGate
        motion={<CounterRow stats={stats} />}
        static={<StaticRow stats={stats} />}
      />
    </div>
  )
}
