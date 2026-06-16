'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { useReducedMotion } from '@/hooks/useReducedMotion'

interface LoadingStateProps {
  label?: string
  variant?: 'inline' | 'block'
  useLoadingI?: boolean
}

function LoadingI({ label = 'loading' }: { label?: string }) {
  const prefersReduced = useReducedMotion()
  const iIdx = label.indexOf('i')
  const pre  = iIdx === -1 ? label : label.slice(0, iIdx)
  const post = iIdx === -1 ? ''    : label.slice(iIdx + 1)

  const dot = prefersReduced ? (
    <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: 'var(--violet-400)', display: 'block' }} />
  ) : (
    <motion.span
      style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: 'var(--violet-400)', display: 'block' }}
      animate={{ scale: [1, 1.5, 1], opacity: [1, 0.6, 1] }}
      transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
    />
  )

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '1px', color: 'var(--violet-400)', fontSize: '12px', fontWeight: 500 }}>
      {pre}
      <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '1px', margin: '0 1px', position: 'relative', top: '-1px' }}>
        {dot}
        <span style={{ width: 3, height: 8, borderRadius: '2px', backgroundColor: 'var(--violet-400)', display: 'block' }} />
      </span>
      {post}
    </span>
  )
}

export { LoadingI }

export function LoadingState({
  label = 'Loading…',
  variant = 'block',
  useLoadingI = false,
}: LoadingStateProps) {
  const prefersReduced = useReducedMotion()

  const content = useLoadingI
    ? <LoadingI label={label} />
    : <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{label}</span>

  if (variant === 'inline') {
    return <span style={{ display: 'inline-flex', alignItems: 'center' }}>{content}</span>
  }

  if (prefersReduced) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        {content}
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      style={{ textAlign: 'center', padding: '60px 0', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
    >
      {content}
    </motion.div>
  )
}
