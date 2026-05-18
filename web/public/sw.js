/* Info-Sentry Service Worker — push notifications only, no fetch interception */
const CACHE = 'info-sentry-v2'

// ── Install: skip waiting immediately, don't pre-cache anything ──────────────
self.addEventListener('install', () => { self.skipWaiting() })

// ── Message: allow pages to force SW activation ───────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

// ── Activate: clear ALL old caches and take control immediately ──────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

// ── NO fetch handler — let Next.js and the browser handle all requests ────────
// Intercepting fetch causes stale-chunk 400 errors after Next.js rebuilds.

// ── Push: show notification ───────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let payload = {}
  try { payload = event.data?.json() ?? {} } catch { payload = { title: 'Info-Sentry', body: event.data?.text() ?? '' } }

  const title   = payload.title   ?? 'Info-Sentry'
  const body    = payload.body    ?? ''
  const data    = payload.data    ?? {}
  const tag     = payload.tag     ?? ('is-' + (data.type ?? 'general'))

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:   '/icon-192.png',
      badge:  '/badge-72.png',
      tag,
      data,
      requireInteraction: payload.requireInteraction ?? false,
      timestamp: Date.now(),
    })
  )
})

// ── Notification click: open or focus the right page ─────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const data = event.notification.data ?? {}
  let path = '/'

  if (data.articleId)         path = `/article/${data.articleId}`
  else if (data.predictionId) path = `/predictions/${data.predictionId}`
  else if (data.repoId)       path = `/github-feed/${data.repoId}`
  else if (data.videoId)      path = `/video-feed/${data.videoId}`
  else if (data.type === 'new_article')  path = '/feed'
  else if (data.type === 'new_github')   path = '/github-feed'
  else if (data.type === 'new_video')    path = '/video-feed'
  else if (data.type === 'pipeline')     path = '/settings'

  // Mark notification as read via background fetch
  if (data.notificationId) {
    fetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [data.notificationId] }),
    }).catch(() => {})
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const existing = clients.find(c => c.url.includes(self.location.origin))
      if (existing) return existing.focus().then(c => c.navigate(path))
      return self.clients.openWindow(path)
    })
  )
})

// ── Notification close (dismissed from OS tray) ──────────────────────────────
// Intentionally no-op — dismissed from device does NOT mark as read in the app.
// It stays in the in-app notification list until the user explicitly clears it.
self.addEventListener('notificationclose', () => {})
