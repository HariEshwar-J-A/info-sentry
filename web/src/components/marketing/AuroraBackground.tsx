'use client'

import React from 'react'

interface Props {
  children?: React.ReactNode
  className?: string
  style?: React.CSSProperties
  intensity?: 'subtle' | 'medium' | 'strong'
}

/**
 * Full-bleed aurora background: three violet/purple/indigo radial gradients
 * that drift slowly via CSS keyframes. GPU-accelerated via transform/will-change.
 * Respects prefers-reduced-motion via the global CSS rule in globals.css.
 */
export function AuroraBackground({ children, className = '', style, intensity = 'medium' }: Props) {
  const opacities = {
    subtle: [0.25, 0.18, 0.12],
    medium: [0.45, 0.32, 0.22],
    strong: [0.65, 0.50, 0.35],
  }[intensity]

  return (
    <div
      style={{ position: 'relative', overflow: 'hidden', ...style }}
      className={className}
      aria-hidden="false"
    >
      {/* Aurora layer — decorative, hidden from SR */}
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        {/* Orb 1 — primary violet, top-left */}
        <div style={{
          position: 'absolute',
          top: '-20%', left: '-10%',
          width: '70%', height: '70%',
          borderRadius: '50%',
          background: `radial-gradient(ellipse at center, rgba(139,92,246,${opacities[0]}) 0%, transparent 70%)`,
          filter: 'blur(60px)',
          willChange: 'transform',
          animation: 'aurora-drift-1 60s ease-in-out infinite',
        }} />
        {/* Orb 2 — deep purple, bottom-right */}
        <div style={{
          position: 'absolute',
          bottom: '-10%', right: '-5%',
          width: '60%', height: '60%',
          borderRadius: '50%',
          background: `radial-gradient(ellipse at center, rgba(109,40,217,${opacities[1]}) 0%, transparent 70%)`,
          filter: 'blur(80px)',
          willChange: 'transform',
          animation: 'aurora-drift-2 80s ease-in-out infinite',
        }} />
        {/* Orb 3 — indigo, centre-right */}
        <div style={{
          position: 'absolute',
          top: '30%', right: '20%',
          width: '40%', height: '50%',
          borderRadius: '50%',
          background: `radial-gradient(ellipse at center, rgba(192,132,252,${opacities[2]}) 0%, transparent 70%)`,
          filter: 'blur(50px)',
          willChange: 'transform',
          animation: 'aurora-drift-3 70s ease-in-out infinite',
        }} />
        {/* Static grain overlay for depth */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`,
          backgroundSize: '200px 200px',
          opacity: 0.3,
          mixBlendMode: 'overlay',
        }} />
      </div>
      {/* Content above aurora */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </div>
    </div>
  )
}
