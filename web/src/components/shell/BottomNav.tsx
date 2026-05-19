'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Rss, GitBranch, Tag, Target, Database, MessageSquare,
  Sparkles, Settings, Menu, LogOut, Video, Bell, BellOff,
  BellRing, CheckCheck, Trash2, X, Cog, Newspaper, Activity, BookOpen,
} from 'lucide-react'

// ─── Notification types ───────────────────────────────────────

interface NotifItem {
  id: string
  type: string
  title: string
  body: string
  data: Record<string, unknown>
  readAt: string | null
  createdAt: string
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3_600_000)
  if (h > 24) return `${Math.floor(h / 24)}d ago`
  if (h > 0) return `${h}h ago`
  return `${Math.floor(diff / 60_000)}m ago`
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  PREDICTION_VERIFIED: <Sparkles size={14} color="#a5b4fc" />,
  NEW_ARTICLE:         <Newspaper size={14} color="#8a8a8a" />,
  NEW_PREDICTION:      <Target    size={14} color="#8a8a8a" />,
  NEW_GITHUB_REPO:     <GitBranch size={14} color="#8a8a8a" />,
  NEW_VIDEO:           <Video     size={14} color="#8a8a8a" />,
  PIPELINE_SUMMARY:    <Activity  size={14} color="#8a8a8a" />,
  SYSTEM:              <Cog       size={14} color="#8a8a8a" />,
}

function notifRoute(n: NotifItem): string {
  const d = n.data
  if (d.articleId)    return `/article/${d.articleId}`
  if (d.predictionId) return `/predictions/${d.predictionId}`
  if (d.repoId)       return `/github-feed/${d.repoId}`
  if (d.videoId)      return `/video-feed/${d.videoId}`
  if (n.type === 'NEW_ARTICLE')     return '/feed'
  if (n.type === 'NEW_GITHUB_REPO') return '/github-feed'
  if (n.type === 'NEW_VIDEO')       return '/video-feed'
  if (n.type === 'PREDICTION_VERIFIED' || n.type === 'NEW_PREDICTION') return '/predictions'
  if (n.type === 'PIPELINE_SUMMARY') return '/settings'
  return '/'
}

// ─── Push helpers ─────────────────────────────────────────────

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  return new Uint8Array([...raw].map(c => c.charCodeAt(0)))
}

async function subscribeToPush(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false
  const publicKey = process.env['NEXT_PUBLIC_VAPID_PUBLIC_KEY']
  if (!publicKey) return false
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return false
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as ArrayBuffer,
  })
  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sub.toJSON()),
  })
  return true
}

async function unsubscribeFromPush(): Promise<void> {
  if (!('serviceWorker' in navigator)) return
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return
  const endpoint = sub.endpoint
  await sub.unsubscribe()
  await fetch('/api/push/subscribe', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint }),
  })
}

async function getPushSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

// ─── Notification preferences ─────────────────────────────────

const MUTED_KEY = 'is_muted_types'

function readMutedTypes(): Set<string> {
  try {
    const raw = localStorage.getItem(MUTED_KEY)
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
  } catch { return new Set() }
}

// ─── Nav config ───────────────────────────────────────────────

const PRIMARY_NAV = [
  { href: '/feed',        label: 'Feed',    icon: <Rss size={20} /> },
  { href: '/github-feed', label: 'GitHub',  icon: <GitBranch size={20} /> },
  { href: '/topics',      label: 'Topics',  icon: <Tag size={20} /> },
]

const MORE_NAV = [
  { href: '/summaries',   label: 'Summaries',   icon: <BookOpen size={20} /> },
  { href: '/predictions', label: 'Predictions', icon: <Target size={20} /> },
  { href: '/video-feed',  label: 'Videos',      icon: <Video size={20} /> },
  { href: '/sources',     label: 'Sources',     icon: <Database size={20} /> },
  { href: '/chat',        label: 'Chat',        icon: <MessageSquare size={20} /> },
  { href: '/surprise',    label: 'Surprise',    icon: <Sparkles size={20} /> },
  { href: '/settings',    label: 'Settings',    icon: <Settings size={20} /> },
]

// ─── Component ────────────────────────────────────────────────

export function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotifItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)
  const prevUnreadRef = useRef<number | null>(null)

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/')

  const activeColor = '#6366f1'
  const inactiveColor = '#555'

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: '3px', border: 'none', background: 'none',
    cursor: 'pointer', padding: '8px 4px',
    color: active ? activeColor : inactiveColor,
    textDecoration: 'none', fontSize: '10px', fontWeight: active ? 600 : 400,
    WebkitTapHighlightColor: 'transparent',
  })

  // ── Notification polling ─────────────────────────────────────

  const fetchNotifications = useCallback(() => {
    fetch('/api/notifications')
      .then(r => r.json())
      .then((d: { notifications: NotifItem[]; unreadCount: number }) => {
        const newNotifs = d.notifications ?? []
        setNotifications(newNotifs)
        // Filter muted types from badge count
        const muted = readMutedTypes()
        const effectiveCount = newNotifs.filter(n => !n.readAt && !muted.has(n.type)).length
        setUnreadCount(effectiveCount)
        prevUnreadRef.current = effectiveCount
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchNotifications()
    const id = setInterval(fetchNotifications, 20_000)
    return () => clearInterval(id)
  }, [fetchNotifications])

  useEffect(() => {
    getPushSubscription().then(sub => setPushEnabled(!!sub)).catch(() => {})
  }, [])

  // ── Notification actions ─────────────────────────────────────

  function markRead(ids: string[]) {
    fetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    }).catch(() => {})
    const now = new Date().toISOString()
    setNotifications(p => p.map(n => ids.includes(n.id) ? { ...n, readAt: now } : n))
    setUnreadCount(c => Math.max(0, c - ids.filter(id => notifications.find(n => n.id === id && !n.readAt)).length))
  }

  function markAllRead() {
    fetch('/api/notifications/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }).catch(() => {})
    setUnreadCount(0)
    setNotifications(p => p.map(n => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })))
  }

  function dismissOne(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    fetch('/api/notifications/dismiss', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [id] }),
    }).catch(() => {})
    const wasUnread = notifications.find(n => n.id === id && !n.readAt)
    setNotifications(p => p.filter(n => n.id !== id))
    if (wasUnread) setUnreadCount(c => Math.max(0, c - 1))
  }

  function dismissAllRead() {
    const readIds = notifications.filter(n => n.readAt).map(n => n.id)
    if (readIds.length === 0) return
    fetch('/api/notifications/dismiss', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: readIds }),
    }).catch(() => {})
    setNotifications(p => p.filter(n => !n.readAt))
  }

  function handleNotifClick(n: NotifItem) {
    if (!n.readAt) markRead([n.id])
    setNotifOpen(false)
    router.push(notifRoute(n))
  }

  async function togglePush() {
    setPushLoading(true)
    try {
      if (pushEnabled) {
        await unsubscribeFromPush()
        setPushEnabled(false)
      } else {
        const ok = await subscribeToPush()
        setPushEnabled(ok)
      }
    } catch { /* ignore */ } finally {
      setPushLoading(false)
    }
  }

  const pushSupported = typeof window !== 'undefined' && 'PushManager' in window

  return (
    <>
      {/* Overlay — closes any open panel */}
      {(drawerOpen || notifOpen) && (
        <div
          onClick={() => { setDrawerOpen(false); setNotifOpen(false) }}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 98 }}
        />
      )}

      {/* More drawer */}
      {drawerOpen && (
        <div
          className="slide-up"
          style={{
            position: 'fixed', bottom: 'var(--bottom-nav-h)', left: 0, right: 0,
            backgroundColor: '#111', borderTop: '1px solid #2a2a2a',
            borderRadius: '16px 16px 0 0', padding: '20px 16px 12px',
            zIndex: 99, display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: '8px',
          }}
        >
          {MORE_NAV.map(item => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setDrawerOpen(false)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '12px 14px', borderRadius: '10px',
                backgroundColor: isActive(item.href) ? 'rgba(99,102,241,0.15)' : '#1a1a1a',
                color: isActive(item.href) ? '#a5b4fc' : '#a0a0a0',
                textDecoration: 'none', fontSize: '14px', fontWeight: 500,
              }}
            >
              <span style={{ color: isActive(item.href) ? activeColor : '#555', flexShrink: 0 }}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          ))}

          <button
            onClick={() => {
              void fetch('/api/auth/logout', { method: 'POST' })
                .then(() => { window.location.href = '/login' })
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '12px 14px', borderRadius: '10px',
              backgroundColor: '#1a1a1a', color: '#ef4444',
              border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 500,
              textAlign: 'left',
            }}
          >
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      )}

      {/* Notification sheet */}
      {notifOpen && (
        <div
          className="slide-up"
          style={{
            position: 'fixed', bottom: 'var(--bottom-nav-h)', left: 0, right: 0,
            backgroundColor: '#111', borderTop: '1px solid #2a2a2a',
            borderRadius: '16px 16px 0 0', zIndex: 99,
            display: 'flex', flexDirection: 'column',
            maxHeight: '75vh',
          }}
        >
          {/* Sheet header */}
          <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #1f1f1f', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            <span style={{ fontSize: '15px', fontWeight: 600, color: '#f0f0f0', flex: 1 }}>
              Notifications
              {unreadCount > 0 && <span style={{ color: '#6366f1', marginLeft: '6px' }}>({unreadCount})</span>}
            </span>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {unreadCount > 0 && (
                <button onClick={markAllRead} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px', backgroundColor: 'rgba(99,102,241,0.1)' }}>
                  <CheckCheck size={13} /> All read
                </button>
              )}
              {notifications.some(n => n.readAt) && (
                <button onClick={dismissAllRead} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#555', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px' }}>
                  <Trash2 size={12} /> Clear
                </button>
              )}
              <button onClick={() => setNotifOpen(false)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}>
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '40px 16px', textAlign: 'center', color: '#555', fontSize: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}><Bell size={28} color="#333" /></div>
                No notifications yet
              </div>
            ) : notifications.map(n => (
              <div
                key={n.id}
                onClick={() => handleNotifClick(n)}
                style={{
                  padding: '12px 16px', borderBottom: '1px solid #1a1a1a',
                  backgroundColor: !n.readAt ? 'rgba(99,102,241,0.07)' : 'transparent',
                  display: 'flex', gap: '12px', alignItems: 'flex-start', cursor: 'pointer',
                }}
              >
                <span style={{ flexShrink: 0, marginTop: '3px' }}>
                  {TYPE_ICONS[n.type] ?? <Bell size={14} color="#8a8a8a" />}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: n.readAt ? '#666' : '#e0e0e0', marginBottom: '3px' }}>{n.title}</div>
                  <div style={{ fontSize: '12px', color: '#555', lineHeight: '1.4', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{n.body}</div>
                  <div style={{ fontSize: '11px', color: '#3a3a3a', marginTop: '4px' }}>{timeAgo(n.createdAt)}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', flexShrink: 0 }}>
                  {!n.readAt && <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#6366f1' }} />}
                  <button
                    onClick={e => dismissOne(n.id, e)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#333', padding: '4px', display: 'flex', alignItems: 'center', borderRadius: '4px' }}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Push toggle footer */}
          {pushSupported && (
            <div style={{ padding: '12px 16px', borderTop: '1px solid #1f1f1f', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
              <span style={{ fontSize: '12px', color: '#555', flex: 1 }}>
                {pushEnabled ? 'Device push notifications on' : 'Device push notifications off'}
              </span>
              <button
                onClick={() => void togglePush()}
                disabled={pushLoading}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  fontSize: '12px', padding: '6px 12px', borderRadius: '8px',
                  border: `1px solid ${pushEnabled ? 'rgba(99,102,241,0.3)' : '#2a2a2a'}`,
                  background: pushEnabled ? 'rgba(99,102,241,0.1)' : 'none',
                  color: pushEnabled ? '#a5b4fc' : '#555',
                  cursor: pushLoading ? 'wait' : 'pointer',
                }}
              >
                {pushLoading ? <Cog size={13} /> : pushEnabled ? <BellRing size={13} /> : <BellOff size={13} />}
                {pushEnabled ? 'On' : 'Off'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Bottom tab bar */}
      <nav className="bottom-nav">
        {PRIMARY_NAV.map(item => (
          <Link key={item.href} href={item.href} style={tabStyle(isActive(item.href))}>
            {item.icon}
            {item.label}
          </Link>
        ))}

        {/* Notifications bell */}
        <button
          onClick={() => { setNotifOpen(o => !o); setDrawerOpen(false) }}
          style={{ ...tabStyle(notifOpen), position: 'relative' }}
        >
          <span style={{ position: 'relative', display: 'inline-flex' }}>
            <Bell size={20} />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute', top: '-4px', right: '-6px',
                minWidth: '16px', height: '16px', borderRadius: '8px',
                backgroundColor: '#6366f1', color: '#fff',
                fontSize: '9px', fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 3px', border: '1.5px solid #0d0d0d',
              }}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </span>
          Alerts
        </button>

        {/* More */}
        <button
          onClick={() => { setDrawerOpen(o => !o); setNotifOpen(false) }}
          style={tabStyle(drawerOpen)}
        >
          <Menu size={20} />
          More
        </button>
      </nav>
    </>
  )
}
