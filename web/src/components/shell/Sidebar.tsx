'use client'

import React, { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Rss, GitBranch, MessageSquare, Tag, Activity, Database, Target,
  Sparkles, Settings, Bell, BellOff, BellRing, LogOut, Newspaper,
  Zap, Cog, Video, X, CheckCheck, Trash2,
} from 'lucide-react'

// ─── Notification Sound ────────────────────────────────────

function playNotificationSound(count: number) {
  try {
    const ctx = new AudioContext()
    const notes = count === 1 ? [880, 660] : [440, 550, 660].slice(0, Math.min(count, 3))
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = freq
      const t = ctx.currentTime + i * 0.18
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.18, t + 0.04)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45)
      osc.start(t)
      osc.stop(t + 0.45)
    })
    setTimeout(() => ctx.close().catch(() => {}), (notes.length * 180 + 500))
  } catch { /* audio not available */ }
}

// ─── Push subscription helpers ─────────────────────────────

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

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  return new Uint8Array([...raw].map(c => c.charCodeAt(0)))
}

// ─── Nav + icon maps ───────────────────────────────────────

interface NavItem { href: string; label: string; icon: React.ReactNode }

const NAV: NavItem[] = [
  { href: '/feed',        label: 'Feed',        icon: <Rss size={18} /> },
  { href: '/github-feed', label: 'GitHub Feed',  icon: <GitBranch size={18} /> },
  { href: '/video-feed',  label: 'Video Feed',   icon: <Video size={18} /> },
  { href: '/chat',        label: 'Chat',         icon: <MessageSquare size={18} /> },
  { href: '/topics',      label: 'Topics',       icon: <Tag size={18} /> },
  { href: '/runs',        label: 'Runs',         icon: <Activity size={18} /> },
  { href: '/sources',     label: 'Sources',      icon: <Database size={18} /> },
  { href: '/predictions', label: 'Predictions',  icon: <Target size={18} /> },
  { href: '/surprise',    label: 'Surprise Me',  icon: <Sparkles size={18} /> },
  { href: '/settings',    label: 'Settings',     icon: <Settings size={18} /> },
]

const TYPE_ICONS: Record<string, React.ReactNode> = {
  PREDICTION_VERIFIED: <Sparkles size={15} color="#a5b4fc" />,
  NEW_ARTICLE:         <Newspaper size={15} color="#8a8a8a" />,
  NEW_PREDICTION:      <Target    size={15} color="#8a8a8a" />,
  NEW_GITHUB_REPO:     <GitBranch size={15} color="#8a8a8a" />,
  NEW_VIDEO:           <Video     size={15} color="#8a8a8a" />,
  PIPELINE_SUMMARY:    <Activity  size={15} color="#8a8a8a" />,
  SYSTEM:              <Cog       size={15} color="#8a8a8a" />,
}

function notifRoute(n: { type: string; data: Record<string, unknown> }): string {
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

interface BudgetData { spentUsd: number; budgetUsd: number; percent: number }

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [budget, setBudget] = useState<BudgetData | null>(null)
  const [notifications, setNotifications] = useState<NotifItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifOpen, setNotifOpen] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)
  const bellRef = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const prevUnreadRef = useRef<number | null>(null)
  const pendingSoundRef = useRef(0)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Check push subscription state on mount
  useEffect(() => {
    getPushSubscription().then(sub => setPushEnabled(!!sub)).catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/budget').then(r => r.json()).then(d => setBudget(d)).catch(() => {})
  }, [])

  const fetchNotifications = useCallback(() => {
    fetch('/api/notifications')
      .then(r => r.json())
      .then((d: { notifications: NotifItem[]; unreadCount: number }) => {
        const newNotifs = d.notifications ?? []
        const newCount = d.unreadCount ?? 0
        setNotifications(newNotifs)
        setUnreadCount(newCount)

        if (prevUnreadRef.current !== null && newCount > prevUnreadRef.current) {
          const arrived = newCount - prevUnreadRef.current
          pendingSoundRef.current += arrived

          if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
          debounceTimerRef.current = setTimeout(() => {
            playNotificationSound(pendingSoundRef.current)
            pendingSoundRef.current = 0
            debounceTimerRef.current = null
          }, 10_000)
        }

        prevUnreadRef.current = newCount
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchNotifications()
    const id = setInterval(fetchNotifications, 20_000)
    return () => { clearInterval(id); if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current) }
  }, [fetchNotifications])

  useEffect(() => {
    if (!notifOpen) return
    function handler(e: MouseEvent) {
      if (
        bellRef.current && !bellRef.current.contains(e.target as Node) &&
        dropRef.current && !dropRef.current.contains(e.target as Node)
      ) setNotifOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [notifOpen])

  // ── Notification actions ─────────────────────────────────

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

  // ── Push toggle ──────────────────────────────────────────

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
    } catch (err) {
      console.warn('[push] Toggle error:', err)
    } finally {
      setPushLoading(false)
    }
  }

  const pushSupported = typeof window !== 'undefined' && 'PushManager' in window

  return (
    <aside className="layout-sidebar">
      {/* Logo */}
      <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid #1a1a1a' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center' }}>
          <div style={{ width: '28px', height: '28px', flexShrink: 0, borderRadius: '8px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={14} color="#fff" strokeWidth={2.5} />
          </div>
          <div className="sidebar-logo-text">
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#f0f0f0', letterSpacing: '-0.02em' }}>Info-Sentry</div>
            <div style={{ fontSize: '11px', color: '#8a8a8a' }}>AI News Intelligence</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 8px', overflow: 'auto' }}>
        {NAV.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link key={item.href} href={item.href} title={item.label}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '8px', marginBottom: '2px', fontSize: '14px', fontWeight: isActive ? 500 : 400, color: isActive ? '#f0f0f0' : '#8a8a8a', backgroundColor: isActive ? '#1a1a1a' : 'transparent', textDecoration: 'none', transition: 'all 0.15s', justifyContent: 'flex-start' }}
              onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.color = '#d0d0d0'; (e.currentTarget as HTMLElement).style.backgroundColor = '#141414' } }}
              onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.color = '#8a8a8a'; (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent' } }}
            >
              <span style={{ color: isActive ? '#6366f1' : 'currentColor', opacity: isActive ? 1 : 0.7, flexShrink: 0 }}>{item.icon}</span>
              <span className="sidebar-label">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Notification Bell */}
      <div className="sidebar-notif-label" style={{ padding: '4px 8px', position: 'relative' }}>
        <button ref={bellRef} onClick={() => setNotifOpen(o => !o)}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '8px', background: notifOpen ? '#1a1a1a' : 'none', border: 'none', cursor: 'pointer', color: unreadCount > 0 ? '#d0d0d0' : '#8a8a8a', fontSize: '14px', transition: 'all 0.15s' }}>
          <span style={{ opacity: unreadCount > 0 ? 1 : 0.7, color: unreadCount > 0 ? '#6366f1' : 'currentColor', position: 'relative', flexShrink: 0 }}>
            <Bell size={18} />
            {unreadCount > 0 && (
              <span style={{ position: 'absolute', top: '-3px', right: '-3px', width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#6366f1', animation: 'pulse-dot 1.5s ease-in-out infinite', border: '1.5px solid #0d0d0d' }} />
            )}
          </span>
          <span className="sidebar-label">Notifications</span>
          {unreadCount > 0 && (
            <span className="sidebar-label" style={{ marginLeft: 'auto', minWidth: '18px', height: '18px', borderRadius: '9px', backgroundColor: '#6366f1', color: '#fff', fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* Notification dropdown */}
        {notifOpen && (
          <div ref={dropRef} style={{ position: 'fixed', left: 'calc(var(--sidebar-w) + 4px)', bottom: '100px', width: '360px', backgroundColor: '#141414', border: '1px solid #2a2a2a', borderRadius: '12px', boxShadow: '0 8px 40px rgba(0,0,0,0.7)', zIndex: 200, overflow: 'hidden', maxHeight: '520px', display: 'flex', flexDirection: 'column' }}>

            {/* Header */}
            <div style={{ padding: '12px 14px', borderBottom: '1px solid #1f1f1f', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#f0f0f0', flex: 1 }}>
                Notifications {unreadCount > 0 && <span style={{ color: '#6366f1' }}>({unreadCount} new)</span>}
              </span>
              <div style={{ display: 'flex', gap: '4px' }}>
                {unreadCount > 0 && (
                  <button onClick={markAllRead} title="Mark all read" style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', padding: '3px 6px', borderRadius: '5px' }}>
                    <CheckCheck size={12} /> All read
                  </button>
                )}
                {notifications.some(n => n.readAt) && (
                  <button onClick={dismissAllRead} title="Clear read notifications" style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: '#555', background: 'none', border: 'none', cursor: 'pointer', padding: '3px 6px', borderRadius: '5px' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#ef4444'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#555'}
                  >
                    <Trash2 size={11} /> Clear read
                  </button>
                )}
              </div>
            </div>

            {/* Notification list */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {notifications.length === 0 ? (
                <div style={{ padding: '32px 16px', textAlign: 'center', color: '#555', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}><Bell size={24} color="#333" /></div>
                  No notifications yet
                </div>
              ) : notifications.map((n) => (
                <div key={n.id}
                  style={{ padding: '10px 14px', borderBottom: '1px solid #1a1a1a', backgroundColor: !n.readAt ? 'rgba(99,102,241,0.06)' : 'transparent', transition: 'background 0.15s', cursor: 'pointer', display: 'flex', gap: '10px', alignItems: 'flex-start' }}
                  onClick={() => handleNotifClick(n)}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = !n.readAt ? 'rgba(99,102,241,0.1)' : '#1a1a1a'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = !n.readAt ? 'rgba(99,102,241,0.06)' : 'transparent'}
                >
                  <span style={{ flexShrink: 0, marginTop: '2px' }}>{TYPE_ICONS[n.type] ?? <Bell size={15} color="#8a8a8a" />}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: n.readAt ? '#666' : '#e0e0e0', marginBottom: '2px' }}>{n.title}</div>
                    <div style={{ fontSize: '11px', color: '#555', lineHeight: '1.4', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{n.body}</div>
                    <div style={{ fontSize: '10px', color: '#444', marginTop: '3px' }}>{timeAgo(n.createdAt)}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                    {!n.readAt && <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#6366f1' }} />}
                    <button
                      onClick={e => dismissOne(n.id, e)}
                      title="Dismiss"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#333', padding: '2px', display: 'flex', alignItems: 'center', borderRadius: '3px' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#ef4444'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#333'}
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer: push toggle */}
            {pushSupported && (
              <div style={{ padding: '10px 14px', borderTop: '1px solid #1f1f1f', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', color: '#555', flex: 1 }}>
                  {pushEnabled ? 'Device notifications on' : 'Device notifications off'}
                </span>
                <button
                  onClick={() => void togglePush()}
                  disabled={pushLoading}
                  title={pushEnabled ? 'Disable push notifications' : 'Enable push notifications'}
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', padding: '4px 10px', borderRadius: '6px', border: `1px solid ${pushEnabled ? 'rgba(99,102,241,0.3)' : '#2a2a2a'}`, background: pushEnabled ? 'rgba(99,102,241,0.1)' : 'none', color: pushEnabled ? '#a5b4fc' : '#555', cursor: pushLoading ? 'wait' : 'pointer' }}
                >
                  {pushLoading ? <Cog size={12} /> : pushEnabled ? <BellRing size={12} /> : <BellOff size={12} />}
                  {pushEnabled ? 'On' : 'Off'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Logout */}
      {typeof window !== 'undefined' && document.cookie.includes('is_auth') && (
        <div style={{ padding: '0 10px 4px' }}>
          <button
            onClick={() => {
              void fetch('/api/auth/logout', { method: 'POST' }).then(() => { window.location.href = '/login' })
            }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '8px', background: 'none', border: 'none', cursor: 'pointer', color: '#555', fontSize: '13px' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ef4444'; (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(239,68,68,0.06)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#555'; (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent' }}
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      )}

      {/* Budget */}
      <div className="sidebar-budget" style={{ padding: '12px 20px 16px', borderTop: '1px solid #1a1a1a' }}>
        {budget ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '11px', color: '#8a8a8a' }}>Monthly Budget</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: budget.percent > 80 ? '#ef4444' : budget.percent > 60 ? '#eab308' : '#22c55e', animation: 'pulse-dot 2s ease-in-out infinite' }} />
                <span style={{ fontSize: '11px', color: budget.percent > 80 ? '#ef4444' : budget.percent > 60 ? '#eab308' : '#8a8a8a' }}>{Math.round(budget.percent)}%</span>
              </div>
            </div>
            <div style={{ width: '100%', height: '3px', backgroundColor: '#1f1f1f', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ width: `${budget.percent}%`, height: '100%', backgroundColor: budget.percent > 80 ? '#ef4444' : budget.percent > 60 ? '#eab308' : '#6366f1', borderRadius: '3px', transition: 'width 0.3s' }} />
            </div>
            <div style={{ fontSize: '10px', color: '#555', marginTop: '4px' }}>${budget.spentUsd.toFixed(2)} / ${budget.budgetUsd.toFixed(2)} USD</div>
          </div>
        ) : (
          <div style={{ height: '38px', backgroundColor: '#151515', borderRadius: '6px' }} />
        )}
      </div>
    </aside>
  )
}
