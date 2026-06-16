'use client'

import { useEffect, useState } from 'react'
import { useSpring, useMotionValue, useTransform, motion } from 'framer-motion'
import { useReducedMotion } from '@/hooks/useReducedMotion'

interface UsageData { spentUsd: number; capUsd: number; percent: number }

export function UsageMeter() {
  const [data, setData] = useState<UsageData | null>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    fetch('/api/budget/me').then(r => r.json()).then(setData).catch(() => {})
  }, [])

  const motionPercent = useMotionValue(0)
  const springPercent = useSpring(motionPercent, { stiffness: 80, damping: 20 })
  const barWidth = useTransform(springPercent, v => `${Math.min(100, v)}%`)

  useEffect(() => {
    if (data) motionPercent.set(data.percent)
  }, [data, motionPercent])

  if (!data) {
    return (
      <div style={{ padding: '12px 16px 14px', borderTop: '1px solid var(--border)' }}>
        <div style={{ height: 38, borderRadius: 6, background: 'var(--surface)' }} />
      </div>
    )
  }

  const isWarning = data.percent > 80
  const isMid     = data.percent > 50
  const barColor  = isWarning ? 'var(--negative)' : isMid ? 'var(--warning)' : 'var(--violet-400)'
  const dotColor  = barColor

  return (
    <div style={{ padding: '12px 16px 14px', borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.02em' }}>
          Free intelligence
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%', backgroundColor: dotColor,
            animation: 'pulse-dot 2s ease-in-out infinite',
          }} />
          <span style={{ fontSize: 11, color: isWarning ? 'var(--negative)' : 'var(--text-muted)' }}>
            {Math.round(data.percent)}%
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div
        role="progressbar"
        aria-valuenow={Math.round(data.percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Monthly AI budget: ${Math.round(data.percent)}% used`}
        style={{ width: '100%', height: 3, backgroundColor: 'var(--surface-2)', borderRadius: 3, overflow: 'hidden' }}
      >
        {reduced ? (
          <div style={{ width: `${Math.min(100, data.percent)}%`, height: '100%', backgroundColor: barColor, borderRadius: 3 }} />
        ) : (
          <motion.div style={{ width: barWidth, height: '100%', backgroundColor: barColor, borderRadius: 3 }} />
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 5 }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          ${data.spentUsd.toFixed(3)} / ${data.capUsd.toFixed(2)}
        </span>
        {isWarning && (
          <a href="/sentry/waitlist" style={{ fontSize: 10, color: 'var(--violet-400)', textDecoration: 'none' }}>
            Get more →
          </a>
        )}
      </div>
    </div>
  )
}
