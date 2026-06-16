'use client'

import { useRef } from 'react'
import { motion, useMotionValue, useTransform, useSpring } from 'framer-motion'
import { MotionGate } from '@/components/a11y/MotionGate'

interface Props {
  href?: string
  className?: string
}

function MagneticPill({ href, className }: Props) {
  const ref = useRef<HTMLAnchorElement & HTMLSpanElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const springX = useSpring(x, { stiffness: 300, damping: 25 })
  const springY = useSpring(y, { stiffness: 300, damping: 25 })
  const rotateX = useTransform(springY, [-20, 20], [6, -6])
  const rotateY = useTransform(springX, [-20, 20], [-6, 6])

  const handleMove = (e: React.MouseEvent) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    x.set((e.clientX - cx) * 0.4)
    y.set((e.clientY - cy) * 0.4)
  }

  const handleLeave = () => {
    x.set(0)
    y.set(0)
  }

  const sharedStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 14px',
    borderRadius: 999,
    border: '1px solid var(--violet-700)',
    background: 'rgba(139, 92, 246, 0.08)',
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text-secondary)',
    textDecoration: 'none',
    cursor: href ? 'pointer' : 'default',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
  }

  const pill = (
    <motion.span
      ref={ref as React.Ref<HTMLSpanElement>}
      style={{ ...sharedStyle, x: springX, y: springY, rotateX, rotateY }}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className={className}
    >
      <span style={{ color: 'var(--violet-400)', fontWeight: 600 }}>by</span>
      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Harieshwar J A</span>
    </motion.span>
  )

  if (href) {
    return (
      <a href={href} aria-label="Visit Harieshwar J A's website" style={{ textDecoration: 'none' }}>
        {pill}
      </a>
    )
  }

  return pill
}

export function HarieshwarBadge({ href, className }: Props) {
  const staticPill = (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 14px',
        borderRadius: 999,
        border: '1px solid var(--violet-700)',
        background: 'rgba(139, 92, 246, 0.08)',
        fontSize: 13,
        fontWeight: 500,
        color: 'var(--text-secondary)',
      }}
    >
      <span style={{ color: 'var(--violet-400)', fontWeight: 600 }}>by</span>
      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Harieshwar J A</span>
    </span>
  )

  return (
    <MotionGate
      motion={<MagneticPill href={href} className={className} />}
      static={staticPill}
    />
  )
}
