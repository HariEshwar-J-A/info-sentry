'use client'

import { useRef, useState } from 'react'
import { MotionGate } from '@/components/a11y/MotionGate'

const MARQUEE_WORDS = [
  'intelligence', 'innovation', 'imagination', 'insight', 'intuition',
  'ingenuity', 'impact', 'inspiration', 'invention', 'instinct',
  'inquiry', 'initiative', 'intensity', 'integrity', 'intention',
]

function AnimatedMarquee() {
  const [paused, setPaused] = useState(false)
  const trackRef = useRef<HTMLDivElement>(null)

  const words = [...MARQUEE_WORDS, ...MARQUEE_WORDS]

  return (
    <div
      style={{ overflow: 'hidden', padding: '40px 0', cursor: 'default', userSelect: 'none' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-label="infoSentry — built around i: intelligence, innovation, imagination and more"
      role="marquee"
    >
      <div
        ref={trackRef}
        style={{
          display: 'flex',
          gap: 0,
          animation: paused ? 'none' : 'marquee-scroll 40s linear infinite',
          width: 'max-content',
        }}
      >
        {words.map((word, i) => (
          <span
            key={`${word}-${i}`}
            style={{
              padding: '0 32px',
              fontSize: 'clamp(18px, 2.5vw, 28px)',
              fontFamily: 'Sora, sans-serif',
              fontWeight: 600,
              color: i % 3 === 0 ? 'var(--violet-300)' : 'var(--text-muted)',
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap',
            }}
            aria-hidden="true"
          >
            {word}
          </span>
        ))}
      </div>
      <style>{`
        @keyframes marquee-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  )
}

function StaticMarquee() {
  return (
    <div style={{ padding: '40px 24px', textAlign: 'center' }} aria-label="infoSentry is built around i: intelligence, innovation, imagination, insight and more">
      <p style={{
        fontSize: 20,
        fontFamily: 'Sora, sans-serif',
        color: 'var(--text-muted)',
        letterSpacing: '-0.01em',
      }}>
        {MARQUEE_WORDS.slice(0, 7).map((w, i) => (
          <span key={w}>
            <span style={{ color: i === 0 ? 'var(--violet-300)' : 'inherit' }}>{w}</span>
            {i < 6 ? <span style={{ margin: '0 12px', opacity: 0.3 }}>·</span> : null}
          </span>
        ))}
      </p>
    </div>
  )
}

export function ManifestoMarquee() {
  return (
    <section
      aria-labelledby="marquee-label"
      style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}
    >
      <p id="marquee-label" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' }}>
        The i in infoSentry stands for
      </p>
      <MotionGate motion={<AnimatedMarquee />} static={<StaticMarquee />} />
    </section>
  )
}
