/* Info-Sentry Service Worker — push notifications + offline shell caching */
const CACHE = 'info-sentry-v1'
const OFFLINE_URLS = ['/', '/feed', '/predictions', '/video-feed', '/github-feed']

// ── Install: pre-cache the app shell ────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then(c => c.addAll(OFFLINE_URLS)).catch(() => {})
  )
  self.skipWaiting()
})

// ── Activate: clear old caches ───────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// ── Fetch: network-first, cache fallback for navigation ──────
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  const url = new URL(event.request.url)
  // Only cache same-origin navigation requests
  if (url.origin !== self.location.origin) return
  if (event.request.mode !== 'navigate') return

  event.respondWith(
    fetch(event.request)
      .then(res => {
        const clone = res.clone()
        caches.open(CACHE).then(c => c.put(event.request, clone)).catch(() => {})
        return res
      })
      .catch(() => caches.match(event.request).then(r => r ?? caches.match('/')))
  )
})

// ── Push: show notification ───────────────────────────────────
self.addEventListener('push', (event) => {
  let payload = {}
  try { payload = event.data?.json() ?? {} } catch { payload = { title: 'Info-Sentry', body: event.data?.text() ?? '' } }

  const title   = payload.title   ?? 'Info-Sentry'
  const body    = payload.body    ?? ''
  const data    = payload.data    ?? {}
  const tag     = payload.tag     ?? ('is-' + (data.type ?? 'general'))
  const icon    = '/icon-192.png'
  const badge   = '/badge-72.png'

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      tag,
      data,
      requireInteraction: payload.requireInteraction ?? false,
      timestamp: Date.now(),
    })
  )
})

// ── Notification click: open or focus the right page ─────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const data = event.notification.data ?? {}
  let path = '/'

  if (data.articleId)    path = `/article/${data.articleId}`
  else if (data.predictionId) path = `/predictions/${data.predictionId}`
  else if (data.repoId)  path = `/github-feed/${data.repoId}`
  else if (data.videoId) path = `/video-feed/${data.videoId}`
  else if (data.type === 'new_article')    path = '/feed'
  else if (data.type === 'new_github')     path = '/github-feed'
  else if (data.type === 'new_video')      path = '/video-feed'
  else if (data.type === 'pipeline')       path = '/settings'

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

// ── Notification close (dismissed from device tray) ─────────
self.addEventListener('notificationclose', () => {
  // Dismissed from OS — we intentionally do NOT mark as read here
  // so it stays in the in-app notification list until explicitly cleared
})
