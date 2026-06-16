'use client'

import { useEffect, useRef } from 'react'

interface Props {
  message: string
  politeness?: 'polite' | 'assertive'
}

/**
 * Invisible live region that announces dynamic content changes to screen
 * readers. Polite for normal updates; assertive only for urgent errors.
 */
export function LiveRegion({ message, politeness = 'polite' }: Props) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (ref.current) {
      // Clear then re-set forces re-announcement even for identical strings
      ref.current.textContent = ''
      const id = setTimeout(() => {
        if (ref.current) ref.current.textContent = message
      }, 50)
      return () => clearTimeout(id)
    }
  }, [message])

  return (
    <span
      ref={ref}
      role="status"
      aria-live={politeness}
      aria-atomic="true"
      style={{
        position: 'absolute',
        width: 1,
        height: 1,
        padding: 0,
        margin: -1,
        overflow: 'hidden',
        clip: 'rect(0,0,0,0)',
        whiteSpace: 'nowrap',
        border: 0,
      }}
    />
  )
}
