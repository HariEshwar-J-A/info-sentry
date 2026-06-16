'use client'

import { useState, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { MotionGate } from '@/components/a11y/MotionGate'

const DEFAULT_WORDS = [
  'intelligence',
  'innovation',
  'imagination',
  'insight',
  'intuition',
  'ingenuity',
  'impact',
  'inspiration',
  'invention',
  'instinct',
  'you',
]

export const PRODUCT_WORDS: Record<string, string[]> = {
  iFeeds:    ['informed', 'ingest', 'intel', 'interpret', 'insight'],
  iGitHub:   ['inspect', 'iterate', 'index', 'investigate', 'innovate'],
  iVideos:   ['immerse', 'ingest', 'inform', 'interpret', 'intuit'],
  iChat:     ['interact', 'interview', 'iterate', 'inquire', 'intelligent'],
  iSurprise: ['imagine', 'invent', 'inspire'],
}

interface Props {
  words?: string[]
  /** Font size — defaults to fluid clamp(48px, 8vw, 120px) */
  fontSize?: string
  /** Label prefix before the cycling word, default is "i" */
  prefix?: string
  /** ms between word changes */
  interval?: number
  className?: string
}

export function IDefinitionCycler({
  words = DEFAULT_WORDS,
  fontSize = 'clamp(48px, 8vw, 120px)',
  prefix = 'i',
  interval = 2500,
  className = '',
}: Props) {
  const [index, setIndex] = useState(0)
  const [announced, setAnnounced] = useState('')
  const announceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    const id = setInterval(() => {
      setIndex(i => (i + 1) % words.length)
    }, interval)
    return () => clearInterval(id)
  }, [words, interval])

  // Throttle SR announcements to once per 5s to avoid flooding
  useEffect(() => {
    clearTimeout(announceTimer.current)
    announceTimer.current = setTimeout(() => {
      setAnnounced(`${prefix} equals ${words[index]}`)
    }, 5000)
    return () => clearTimeout(announceTimer.current)
  }, [index, words, prefix])

  const isLast = index === words.length - 1

  const staticVersion = (
    <p
      style={{
        fontFamily: 'Sora, Inter, sans-serif',
        fontSize,
        fontWeight: 800,
        lineHeight: 1.05,
        letterSpacing: '-0.03em',
        color: 'var(--text-primary)',
        margin: 0,
      }}
      className={className}
      aria-label={`${prefix} = intelligence`}
    >
      <span style={{ color: 'var(--violet-300)' }}>{prefix}</span>
      <span style={{ color: 'var(--text-muted)', margin: '0 0.2em' }}>=</span>
      <span>intelligence</span>
    </p>
  )

  const animatedVersion = (
    <p
      style={{
        fontFamily: 'Sora, Inter, sans-serif',
        fontSize,
        fontWeight: 800,
        lineHeight: 1.05,
        letterSpacing: '-0.03em',
        color: 'var(--text-primary)',
        margin: 0,
        display: 'flex',
        alignItems: 'baseline',
        flexWrap: 'wrap',
        gap: '0.25em',
      }}
      className={className}
    >
      <span style={{ color: 'var(--violet-300)' }}>{prefix}</span>
      <span style={{ color: 'var(--text-muted)' }}>=</span>
      <span style={{ position: 'relative', display: 'inline-block', minWidth: '6ch' }}>
        <AnimatePresence mode="wait">
          <motion.span
            key={words[index]}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            style={{
              display: 'inline-block',
              color: isLast ? 'var(--violet-300)' : 'var(--text-primary)',
              fontStyle: isLast ? 'italic' : 'normal',
            }}
            aria-live="polite"
          >
            {words[index]}
          </motion.span>
        </AnimatePresence>
      </span>
    </p>
  )

  return (
    <>
      <MotionGate motion={animatedVersion} static={staticVersion} />
      {/* Throttled announcement for screen readers */}
      <span
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: 'absolute',
          width: 1, height: 1,
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)',
          whiteSpace: 'nowrap',
        }}
      >
        {announced}
      </span>
    </>
  )
}
