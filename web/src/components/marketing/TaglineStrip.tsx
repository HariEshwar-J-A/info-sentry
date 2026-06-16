'use client'

import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { MotionGate } from '@/components/a11y/MotionGate'

interface Props {
  tagline: string
  accentWord?: string
}

function AnimatedTagline({ tagline, accentWord }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  const words = tagline.split(' ')

  return (
    <div ref={ref} style={{ overflow: 'hidden' }}>
      <p style={{
        fontFamily: 'Sora, sans-serif',
        fontSize: 'clamp(24px, 3.5vw, 44px)',
        fontWeight: 700,
        color: 'var(--text-primary)',
        letterSpacing: '-0.02em',
        lineHeight: 1.2,
        margin: 0,
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.25em',
        position: 'relative',
      }}>
        {words.map((word, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
            style={{
              display: 'inline-block',
              color: word === accentWord ? 'var(--violet-300)' : 'inherit',
            }}
          >
            {word}
          </motion.span>
        ))}
        {/* Animated underline */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={inView ? { scaleX: 1 } : {}}
          transition={{ duration: 0.7, delay: words.length * 0.06 + 0.1, ease: [0.16, 1, 0.3, 1] }}
          style={{
            position: 'absolute',
            bottom: -6,
            left: 0,
            width: '100%',
            height: 2,
            background: 'linear-gradient(90deg, var(--violet-400), transparent)',
            transformOrigin: 'left',
          }}
        />
      </p>
    </div>
  )
}

export function TaglineStrip({ tagline, accentWord }: Props) {
  return (
    <div style={{ padding: '80px 0', maxWidth: 640 }}>
      <MotionGate
        motion={<AnimatedTagline tagline={tagline} accentWord={accentWord} />}
        static={
          <p style={{
            fontFamily: 'Sora, sans-serif',
            fontSize: 'clamp(24px, 3.5vw, 44px)',
            fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
            margin: 0,
          }}>
            {tagline}
          </p>
        }
      />
    </div>
  )
}
