'use client'

import React, { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Rss, GitBranch, MessageSquare, Tag, Activity, Database, Target,
  Sparkles, Settings, Bell, LogOut, Newspaper, Cog, Video,
} from 'lucide-react'
import { InfoSentryLogo } from './InfoSentryLogo'

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

interface NavItem { href: string; label: string; icon: React.ReactNode }

const NAV: NavItem[] = [
  { href: '/feed',        label: 'iFeeds',       icon: <Rss size={18} /> },
  { href: '/predictions', label: 'iPredictions', icon: <Target size={18} /> },
  { href: '/github-feed', label: 'iGitHub',      icon: <GitBranch size={18} /> },
  { href: '/video-feed',  label: 'iVideos',      icon: <Video size={18} /> },
  { href: '/chat',        label: 'iChat',        icon: <MessageSquare size={18} /> },
  { href: '/topics',      label: 'Topics',       icon: <Tag size={18} /> },
  { href: '/surprise',    label: 'Surprise Me',  icon: <Sparkles size={18} /> },
  { href: '/sources',     label: 'Sources',      icon: <Database size={18} /> },
  { href: '/runs',        label: 'Runs',         icon: <Activity size={18} /> },
  { href: '/settings',    label: 'Settings',     icon: <Settings size={18} /> },
]

const TYPE_ICONS: Record<string, React.ReactNode> = {
  PREDICTION_VERIFIED: <Sparkles size={16} color="#a5b4fc" />,
  NEW_ARTICLE:         <Newspaper size={16} color="#8a8a8a" />,
  NEW_PREDICTION:      <Target size={16} color="#8a8a8a" />,
  SYSTEM:              <Cog size={16} color="#8a8a8a" />,
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
interface UserData { name: string | null; email: string }

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [budget, setBudget] = useState<BudgetData | null>(null)
  const [user, setUser] = useState<UserData | null>(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const userBtnRef = useRef<HTMLButtonElement>(null)
  const [notifications, setNotifications] = useState<NotifItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifOpen, setNotifOpen] = useState(false)
  const bellRef = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const prevUnreadRef = useRef<number | null>(null)
  const pendingSoundRef = useRef(0)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      void Notification.requestPermission()
    }
  }, [])

  useEffect(() => {
    fetch('/api/budget').then(r => r.json()).then(d => setBudget(d)).catch(() => {})
    fetch('/api/auth/me').then(r => r.json()).then((d: { user?: UserData }) => { if (d.user) setUser(d.user) }).catch(() => {})
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

          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            const fresh = newNotifs.filter(n => !n.readAt).slice(0, arrived)
            if (arrived === 1 && fresh[0]) {
              new Notification(fresh[0].title, { body: fresh[0].body, icon: '/favicon.ico', silent: true })
            } else if (arrived > 1) {
              new Notification(`${arrived} new notifications`, { body: fresh.map(n => n.title).join('\n'), icon: '/favicon.ico', silent: true })
            }
          }

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

  useEffect(() => {
    if (!userMenuOpen) return
    function handler(e: MouseEvent) {
      if (
        userBtnRef.current && !userBtnRef.current.contains(e.target as Node) &&
        userMenuRef.current && !userMenuRef.current.contains(e.target as Node)
      ) setUserMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [userMenuOpen])

  function markAllRead() {
    fetch('/api/notifications/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      .then(() => { setUnreadCount(0); setNotifications(p => p.map(n => ({ ...n, readAt: new Date().toISOString() }))) })
      .catch(() => {})
  }

  function handleNotifClick(n: NotifItem) {
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
          <InfoSentryLogo variant="badge" size={28} />
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

        {/* Dropdown */}
        {notifOpen && (
          <div ref={dropRef} style={{ position: 'fixed', left: 'calc(var(--sidebar-w) + 4px)', bottom: '100px', width: '340px', backgroundColor: '#141414', border: '1px solid #2a2a2a', borderRadius: '12px', boxShadow: '0 8px 40px rgba(0,0,0,0.6)', zIndex: 200, overflow: 'hidden', maxHeight: '500px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #1f1f1f', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#f0f0f0' }}>Notifications</span>
              {unreadCount > 0 && (
                <button onClick={markAllRead} style={{ fontSize: '11px', color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>Mark all read</button>
              )}
            </div>

            <div style={{ overflowY: 'auto', flex: 1 }}>
              {notifications.length === 0 ? (
                <div style={{ padding: '32px 16px', textAlign: 'center', color: '#555', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
                    <Bell size={24} color="#333" />
                  </div>
                  No notifications yet
                </div>
              ) : notifications.map((n) => (
                <div key={n.id} onClick={() => handleNotifClick(n)}
                  style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #1a1a1a', backgroundColor: !n.readAt ? 'rgba(99,102,241,0.06)' : 'transparent', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = !n.readAt ? 'rgba(99,102,241,0.1)' : '#1a1a1a'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = !n.readAt ? 'rgba(99,102,241,0.06)' : 'transparent'}
                >
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <span style={{ flexShrink: 0, marginTop: '1px', display: 'flex' }}>{TYPE_ICONS[n.type] ?? <Bell size={16} color="#8a8a8a" />}</span>
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

      {/* User menu */}
      <div style={{ padding: '0 8px 8px', position: 'relative' }}>
        <button ref={userBtnRef} onClick={() => setUserMenuOpen(o => !o)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
            padding: '9px 12px', borderRadius: '8px',
            background: userMenuOpen ? '#1a1a1a' : 'none',
            border: 'none', cursor: 'pointer',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => { if (!userMenuOpen) (e.currentTarget as HTMLElement).style.background = '#141414' }}
          onMouseLeave={e => { if (!userMenuOpen) (e.currentTarget as HTMLElement).style.background = 'none' }}
        >
          {/* Avatar circle with initial */}
          <div style={{
            width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '11px', fontWeight: 700, color: '#fff',
          }}>
            {user?.name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="sidebar-label" style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
            <div style={{ fontSize: '12px', fontWeight: 500, color: '#d0d0d0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.name ?? 'Account'}
            </div>
            <div style={{ fontSize: '10px', color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.email ?? ''}
            </div>
          </div>
        </button>

        {/* Pop-up menu */}
        {userMenuOpen && (
          <div ref={userMenuRef} style={{
            position: 'fixed', left: 'calc(var(--sidebar-w) + 4px)',
            bottom: '12px', width: '200px',
            backgroundColor: '#141414', border: '1px solid #2a2a2a',
            borderRadius: '10px', boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            zIndex: 200, overflow: 'hidden',
          }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid #1f1f1f' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#e0e0e0', marginBottom: '2px' }}>{user?.name ?? 'User'}</div>
              <div style={{ fontSize: '11px', color: '#555' }}>{user?.email}</div>
            </div>
            <button
              onClick={() => {
                setUserMenuOpen(false)
                void fetch('/api/auth/logout', { method: 'POST' }).then(() => { window.location.href = '/login' })
              }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 14px', background: 'none', border: 'none',
                cursor: 'pointer', color: '#ef4444', fontSize: '13px',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(239,68,68,0.08)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent' }}
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        )}
      </div>

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
