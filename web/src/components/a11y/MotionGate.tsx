'use client'

import React from 'react'
import { useReducedMotion } from '@/hooks/useReducedMotion'

interface MotionGateProps {
  /** Rendered when motion is allowed (prefers-reduced-motion: no-preference) */
  motion: React.ReactNode
  /** Rendered when motion is reduced / on SSR first-pass */
  static: React.ReactNode
}

/**
 * Single gate for all animations. Renders the `motion` slot when the user
 * permits motion; falls back to `static` on SSR and for prefers-reduced-motion.
 *
 * Usage:
 *   <MotionGate
 *     motion={<motion.div animate={{ opacity: 1 }} />}
 *     static={<div style={{ opacity: 1 }} />}
 *   />
 */
export function MotionGate({ motion: motionSlot, static: staticSlot }: MotionGateProps) {
  const reduced = useReducedMotion()
  return <>{reduced ? staticSlot : motionSlot}</>
}
