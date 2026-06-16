'use client'

import { useEffect, useState } from 'react'

export function usePrefersHighContrast(): boolean {
  const [highContrast, setHighContrast] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-contrast: more)')
    setHighContrast(mq.matches)
    const handler = (e: MediaQueryListEvent) => setHighContrast(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return highContrast
}
