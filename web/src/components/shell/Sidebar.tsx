'use client'

import React, { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

// ─── Notification Sound ────────────────────────────────────

function playNotificationSound(count: number) {
  try {
    const ctx = new AudioContext()
    // Single: soft descending chime. Multiple: ascending chord stack.
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
    // Auto-close context after sounds finish
    setTimeout(() => ctx.close().catch(() => {}), (notes.length * 180 + 500))
  } catch { /* audio not available */ }
}

interface NavItem { href: string; label: string; icon: React.ReactNode }

function RssIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/></svg> }
function ChatIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> }
function TagIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg> }
function SparklesIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/><path d="M19 17l.75 2.25L22 20l-2.25.75L19 23l-.75-2.25L16 20l2.25-.75L19 17z"/><path d="M5 17l.75 2.25L8 20l-2.25.75L5 23l-.75-2.25L2 20l2.25-.75L5 17z"/></svg> }
function TargetIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg> }
function BellIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> }
function GearIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> }
function GitHubIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg> }
function DatabaseIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg> }
function ActivityIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9-6-18-3 9H2"/></svg> }

const NAV: NavItem[] = [
  { href: '/feed',         label: 'Feed',         icon: <RssIcon /> },
  { href: '/github-feed',  label: 'GitHub Feed',  icon: <GitHubIcon /> },
  { href: '/chat',         label: 'Chat',         icon: <ChatIcon /> },
  { href: '/topics',       label: 'Topics',       icon: <TagIcon /> },
  { href: '/runs',         label: 'Runs',         icon: <ActivityIcon /> },
  { href: '/sources',      label: 'Sources',      icon: <DatabaseIcon /> },
  { href: '/predictions',  label: 'Predictions',  icon: <TargetIcon /> },
  { href: '/surprise',     label: 'Surprise Me',  icon: <SparklesIcon /> },
  { href: '/settings',     label: 'Settings',     icon: <GearIcon /> },
]

const TYPE_ICONS: Record<string, string> = {
  PREDICTION_VERIFIED: '🔮',
  NEW_ARTICLE: '📰',
  NEW_PREDICTION: '🎯',
  SYSTEM: '⚙️',
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
  const bellRef = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  // Sound debounce state
  const prevUnreadRef = useRef<number | null>(null)
  const pendingSoundRef = useRef(0)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Request browser notification permission on first mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      void Notification.requestPermission()
    }
  }, [])

  // Fetch budget once
  useEffect(() => {
    fetch('/api/budget').then(r => r.json()).then(d => setBudget(d)).catch(() => {})
  }, [])

  // Poll notifications every 20s
  const fetchNotifications = useCallback(() => {
    fetch('/api/notifications')
      .then(r => r.json())
      .then((d: { notifications: NotifItem[]; unreadCount: number }) => {
        const newNotifs = d.notifications ?? []
        const newCount = d.unreadCount ?? 0
        setNotifications(newNotifs)
        setUnreadCount(newCount)

        // Detect newly arrived notifications (unread count increased)
        if (prevUnreadRef.current !== null && newCount > prevUnreadRef.current) {
          const arrived = newCount - prevUnreadRef.current
          pendingSoundRef.current += arrived

          // Show browser notification for each new one
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            const fresh = newNotifs.filter(n => !n.readAt).slice(0, arrived)
            if (arrived === 1 && fresh[0]) {
              new Notification(fresh[0].title, { body: fresh[0].body, icon: '/favicon.ico', silent: true })
            } else if (arrived > 1) {
              new Notification(`${arrived} new notifications`, { body: fresh.map(n => n.title).join('\n'), icon: '/favicon.ico', silent: true })
            }
          }

          // Debounce sound: wait 10s for more, then fire once
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

  // Close dropdown on outside click
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

  function markAllRead() {
    fetch('/api/notifications/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      .then(() => { setUnreadCount(0); setNotifications(p => p.map(n => ({ ...n, readAt: new Date().toISOString() }))) })
      .catch(() => {})
  }

  function handleNotifClick(n: NotifItem) {
    // Mark as read
    if (!n.readAt) {
      fetch('/api/notifications/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [n.id] }) }).catch(() => {})
      setNotifications(p => p.map(x => x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x))
      setUnreadCount(c => Math.max(0, c - 1))
    }
    setNotifOpen(false)
    const data = n.data as { predictionId?: string; articleId?: string }
    if (data.predictionId) router.push('/predictions')
    else if (data.articleId) router.push(`/article/${data.articleId}`)
  }

  return (
    <aside className="layout-sidebar">
      {/* Logo */}
      <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid #1a1a1a' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center' }}>
          <div style={{ width: '28px', height: '28px', flexShrink: 0, borderRadius: '8px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>◉</div>
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
            <BellIcon />
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

        {/* Dropdown */}
        {notifOpen && (
          <div ref={dropRef} style={{ position: 'fixed', left: 'calc(var(--sidebar-w) + 4px)', bottom: '100px', width: '340px', backgroundColor: '#141414', border: '1px solid #2a2a2a', borderRadius: '12px', boxShadow: '0 8px 40px rgba(0,0,0,0.6)', zIndex: 200, overflow: 'hidden', maxHeight: '500px', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #1f1f1f', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#f0f0f0' }}>Notifications</span>
              {unreadCount > 0 && (
                <button onClick={markAllRead} style={{ fontSize: '11px', color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>Mark all read</button>
              )}
            </div>

            {/* List */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {notifications.length === 0 ? (
                <div style={{ padding: '32px 16px', textAlign: 'center', color: '#555', fontSize: '13px' }}>
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>🔔</div>
                  No notifications yet
                </div>
              ) : notifications.map((n) => (
                <div key={n.id} onClick={() => handleNotifClick(n)}
                  style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #1a1a1a', backgroundColor: !n.readAt ? 'rgba(99,102,241,0.06)' : 'transparent', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = !n.readAt ? 'rgba(99,102,241,0.1)' : '#1a1a1a'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = !n.readAt ? 'rgba(99,102,241,0.06)' : 'transparent'}
                >
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '16px', flexShrink: 0, marginTop: '1px' }}>{TYPE_ICONS[n.type] ?? '🔔'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: n.readAt ? '#666' : '#e0e0e0', marginBottom: '3px' }}>{n.title}</div>
                      <div style={{ fontSize: '11px', color: '#555', lineHeight: '1.4', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{n.body}</div>
                      <div style={{ fontSize: '10px', color: '#444', marginTop: '4px' }}>{timeAgo(n.createdAt)}</div>
                    </div>
                    {!n.readAt && <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#6366f1', flexShrink: 0, marginTop: '5px' }} />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Logout — only visible when auth is active */}
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
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
