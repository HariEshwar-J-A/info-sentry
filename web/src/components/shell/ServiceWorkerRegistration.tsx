'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(registration => {
      // When a new SW is waiting to activate, send it SKIP_WAITING immediately
      // so it takes over without needing all tabs to close.
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' })
      }

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        if (!newWorker) return
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && registration.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' })
          }
        })
      })

      // When the SW tells us it just took over, reload to get fresh HTML + chunks
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload()
      })
    }).catch(err => console.warn('[SW] Registration failed:', err))
  }, [])

  return null
}
