'use client'

import { useReducedMotion as useFramerReducedMotion } from 'framer-motion'

/**
 * SSR-safe wrapper: defaults to true (no motion) on the server so the first
 * paint always renders the static fallback before client hydration.
 */
export function useReducedMotion(): boolean {
  const prefersReduced = useFramerReducedMotion()
  // null = framer hasn't resolved yet (SSR) — default to true (static)
  return prefersReduced ?? true
}
