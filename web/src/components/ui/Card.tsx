'use client'

import React from 'react'
import { motion, useMotionValue, useMotionTemplate, useSpring, useTransform } from 'framer-motion'
import { useReducedMotion } from '@/hooks/useReducedMotion'

interface CardProps {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  onClick?: () => void
  hoverable?: boolean
  accent?: 'new' | 'status'
  statusColor?: string
}

export function Card({ children, className, style, onClick, hoverable = false, accent, statusColor }: CardProps) {
  const prefersReduced = useReducedMotion()

  const mx = useMotionValue(0.5)
  const my = useMotionValue(0.5)
  const smx = useSpring(mx, { stiffness: 150, damping: 20 })
  const smy = useSpring(my, { stiffness: 150, damping: 20 })
  const rotateX = useTransform(smy, [0, 1], [4, -4])
  const rotateY = useTransform(smx, [0, 1], [-4, 4])
  const spotX = useTransform(smx, v => `${v * 100}%`)
  const spotY = useTransform(smy, v => `${v * 100}%`)
  const spotBg = useMotionTemplate`radial-gradient(180px circle at ${spotX} ${spotY}, rgba(139,92,246,0.10) 0%, transparent 80%)`

  const accentBorder =
    accent === 'new'    ? 'var(--violet-900)' :
    accent === 'status' ? statusColor ?? 'var(--border)' :
    'var(--border)'

  const baseStyle: React.CSSProperties = {
    backgroundColor: 'var(--bg-elevated)',
    border: `1px solid ${accentBorder}`,
    borderRadius: '12px',
    padding: '20px',
    cursor: onClick || hoverable ? 'pointer' : 'default',
    position: 'relative',
    ...style,
  }

  if ((hoverable || onClick) && !prefersReduced) {
    return (
      <motion.div
        className={className}
        style={{
          ...baseStyle,
          rotateX,
          rotateY,
          transformStyle: 'preserve-3d',
          willChange: 'transform',
        }}
        whileHover={{ borderColor: 'var(--border-strong)', backgroundColor: 'var(--surface)' }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          mx.set((e.clientX - rect.left) / rect.width)
          my.set((e.clientY - rect.top) / rect.height)
        }}
        onMouseLeave={() => { mx.set(0.5); my.set(0.5) }}
        onClick={onClick}
      >
        {/* Spotlight overlay */}
        <motion.div
          aria-hidden="true"
          style={{
            position: 'absolute', inset: 0, borderRadius: 'inherit',
            background: spotBg, pointerEvents: 'none', zIndex: 0,
          }}
        />
        <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
      </motion.div>
    )
  }

  if (onClick) {
    return (
      <div
        className={className}
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick() }}
        style={baseStyle}
        onMouseEnter={(e) => {
          ;(e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-strong)'
          ;(e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--surface)'
        }}
        onMouseLeave={(e) => {
          ;(e.currentTarget as HTMLDivElement).style.borderColor = accentBorder
          ;(e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--bg-elevated)'
        }}
      >
        {children}
      </div>
    )
  }

  return (
    <div
      className={className}
      style={baseStyle}
      role="group"
      onMouseEnter={
        hoverable
          ? (e) => {
              ;(e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-strong)'
              ;(e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--surface)'
            }
          : undefined
      }
      onMouseLeave={
        hoverable
          ? (e) => {
              ;(e.currentTarget as HTMLDivElement).style.borderColor = accentBorder
              ;(e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--bg-elevated)'
            }
          : undefined
      }
    >
      {children}
    </div>
  )
}
