'use client'

import React from 'react'

interface InfoSentryLogoProps {
  /**
   * badge    — gradient box with white "i" mark (sidebar, app chrome)
   * mark     — transparent violet "i" mark with pulsating dot (marketing nav)
   * wordmark — badge + "infoSentry" text side-by-side
   */
  variant?: 'badge' | 'mark' | 'wordmark'
  size?: number
  /** Show "a Harieshwar J A initiative" tagline below the wordmark */
  tagline?: boolean
}

export function InfoSentryLogo({ variant = 'badge', size = 28, tagline = false }: InfoSentryLogoProps) {
  const dotDiam = Math.max(4, Math.round(size * 0.2))
  const bodyW   = Math.max(3, Math.round(size * 0.155))
  const bodyH   = Math.max(6, Math.round(size * 0.38))
  const gap     = Math.max(2, Math.round(size * 0.07))

  const isMark = variant === 'mark'
  const dotBg  = isMark ? 'var(--violet-300)' : 'rgba(255,255,255,0.95)'
  const bodyBg = isMark ? 'var(--violet-200)' : '#ffffff'

  const inner = (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap,
    }}>
      <div style={{
        width: dotDiam, height: dotDiam, borderRadius: '50%',
        backgroundColor: dotBg, flexShrink: 0,
        animation: isMark
          ? 'logo-dot-pulse 2s ease-in-out infinite'
          : 'logo-dot-pulse-white 2.5s ease-in-out infinite',
      }} />
      <div style={{
        width: bodyW, height: bodyH,
        borderRadius: Math.ceil(bodyW / 2),
        backgroundColor: bodyBg, flexShrink: 0,
      }} />
    </div>
  )

  const badge = (
    <div style={{
      width: size, height: size,
      borderRadius: Math.round(size * 0.29),
      background: 'linear-gradient(135deg, var(--violet-400), var(--violet-600))',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      {inner}
    </div>
  )

  if (variant === 'mark') return inner

  if (variant === 'wordmark') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: size * 0.4 }}>
          {badge}
          <span style={{
            fontSize: size * 0.72,
            fontFamily: 'Sora, Inter, sans-serif',
            fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
            lineHeight: 1,
          }}>
            infoSentry
          </span>
        </div>
        {tagline && (
          <span style={{
            fontSize: size * 0.36,
            color: 'var(--text-muted)',
            fontFamily: 'Inter, sans-serif',
            fontWeight: 400,
            paddingLeft: size + size * 0.4,
          }}>
            a Harieshwar J A initiative
          </span>
        )}
      </div>
    )
  }

  return badge
}
