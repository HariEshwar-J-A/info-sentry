'use client'

import React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { usePathname } from 'next/navigation'
import { useReducedMotion } from '@/hooks/useReducedMotion'

export function PageTransitionWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const prefersReduced = useReducedMotion()

  if (prefersReduced) return <>{children}</>

  const isMarketing = pathname.startsWith('/sentry')

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: isMarketing ? 8 : 0 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: isMarketing ? -8 : 0 }}
        transition={{ duration: isMarketing ? 0.28 : 0.14, ease: [0.16, 1, 0.3, 1] }}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
