'use client'

import { useEffect } from 'react'

const SW_RELOAD_KEY = 'sw_reload_done'

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(registration => {
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

      // sessionStorage persists through soft reloads (unlike a module variable)
      // so this truly fires only once per browser session, breaking the loop.
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (sessionStorage.getItem(SW_RELOAD_KEY)) return
        sessionStorage.setItem(SW_RELOAD_KEY, '1')
        window.location.reload()
      })
    }).catch(err => console.warn('[SW] Registration failed:', err))
  }, [])

  return null
}
