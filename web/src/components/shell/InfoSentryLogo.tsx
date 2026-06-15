'use client'

import React from 'react'

interface InfoSentryLogoProps {
  /**
   * badge  — 28×28 indigo gradient box containing a white "i" mark (for sidebar, chat avatar)
   * mark   — transparent, violet "i" mark with pulsating dot (for landing page nav, standalone)
   */
  variant?: 'badge' | 'mark'
  size?: number
}

export function InfoSentryLogo({ variant = 'badge', size = 28 }: InfoSentryLogoProps) {
  const dotDiam = Math.max(4, Math.round(size * 0.2))
  const bodyW   = Math.max(3, Math.round(size * 0.155))
  const bodyH   = Math.max(6, Math.round(size * 0.38))
  const gap     = Math.max(2, Math.round(size * 0.07))

  const isMark = variant === 'mark'
  const dotBg  = isMark ? '#6366f1' : 'rgba(255,255,255,0.95)'
  const bodyBg = isMark ? '#d4d8ff' : '#ffffff'

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

  if (variant === 'badge') {
    return (
      <div style={{
        width: size, height: size,
        borderRadius: Math.round(size * 0.29),
        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {inner}
      </div>
    )
  }

  return inner
}
