'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Rss, GitBranch, Tag, Target, Database, MessageSquare, Sparkles, Settings, Menu, LogOut, Video, Activity } from 'lucide-react'

const PRIMARY_NAV = [
  { href: '/iFeeds',   label: 'iFeeds',    icon: <Rss size={20} /> },
  { href: '/iGitHub',  label: 'iGitHub',   icon: <GitBranch size={20} /> },
  { href: '/iVideos',  label: 'iVideos',   icon: <Video size={20} /> },
  { href: '/iChat',    label: 'iChat',     icon: <MessageSquare size={20} /> },
]

const MORE_NAV = [
  { href: '/iSurprise',      label: 'iSurprise', icon: <Sparkles size={20} /> },
  { href: '/settings',       label: 'Settings',  icon: <Settings size={20} /> },
]

const MANAGE_NAV = [
  { href: '/iFeeds/topics',  label: 'Topics',  icon: <Tag size={20} /> },
  { href: '/iFeeds/sources', label: 'Sources', icon: <Database size={20} /> },
  { href: '/runs',           label: 'Runs',    icon: <Activity size={20} /> },
]

export function BottomNav() {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [betaPredictions, setBetaPredictions] = useState(false)

  useEffect(() => {
    setBetaPredictions(localStorage.getItem('infosentry_beta_predictions') === 'true')
  }, [])

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/')

  const activeColor = '#c084fc'
  const inactiveColor = '#555'

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: '3px', border: 'none', background: 'none',
    cursor: 'pointer', padding: '8px 4px',
    color: active ? activeColor : inactiveColor,
    textDecoration: 'none', fontSize: '10px', fontWeight: active ? 600 : 400,
    WebkitTapHighlightColor: 'transparent',
  })

  return (
    <>
      {/* Drawer overlay */}
      {drawerOpen && (
        <button
          type="button"
          aria-label="Close drawer"
          onClick={() => setDrawerOpen(false)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 98, border: 'none', cursor: 'default' }}
        />
      )}

      {/* Slide-up drawer */}
      {drawerOpen && (
        <div
          className="slide-up"
          style={{
            position: 'fixed', bottom: 'var(--bottom-nav-h)', left: 0, right: 0,
            backgroundColor: '#111', borderTop: '1px solid #2a2a2a',
            borderRadius: '16px 16px 0 0', padding: '20px 16px 12px',
            zIndex: 99, display: 'flex', flexDirection: 'column', gap: '6px',
          }}
        >
          {/* More nav items */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {MORE_NAV.map(item => (
              <Link key={item.href} href={item.href} onClick={() => setDrawerOpen(false)}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', borderRadius: '10px', backgroundColor: isActive(item.href) ? 'rgba(99,102,241,0.15)' : '#1a1a1a', color: isActive(item.href) ? '#a5b4fc' : '#a0a0a0', textDecoration: 'none', fontSize: '14px', fontWeight: 500 }}
              >
                <span style={{ color: isActive(item.href) ? activeColor : '#555', flexShrink: 0 }}>{item.icon}</span>
                {item.label}
              </Link>
            ))}
            {betaPredictions && (
              <Link href="/predictions" onClick={() => setDrawerOpen(false)}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', borderRadius: '10px', backgroundColor: isActive('/predictions') ? 'rgba(99,102,241,0.15)' : '#1a1a1a', color: isActive('/predictions') ? '#a5b4fc' : '#a0a0a0', textDecoration: 'none', fontSize: '14px', fontWeight: 500 }}
              >
                <span style={{ color: isActive('/predictions') ? activeColor : '#555', flexShrink: 0 }}><Target size={20} /></span>
                iPredictions <span style={{ fontSize: '9px', color: '#6366f1', marginLeft: '2px' }}>β</span>
              </Link>
            )}
          </div>

          {/* Manage group */}
          <div style={{ borderTop: '1px solid #1f1f1f', paddingTop: '6px', marginTop: '2px' }}>
            <div style={{ fontSize: '10px', color: '#444', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '4px 4px 8px' }}>Manage</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {MANAGE_NAV.map(item => (
                <Link key={item.href} href={item.href} onClick={() => setDrawerOpen(false)}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', borderRadius: '10px', backgroundColor: isActive(item.href) ? 'rgba(99,102,241,0.15)' : '#1a1a1a', color: isActive(item.href) ? '#a5b4fc' : '#a0a0a0', textDecoration: 'none', fontSize: '14px', fontWeight: 500 }}
                >
                  <span style={{ color: isActive(item.href) ? activeColor : '#555', flexShrink: 0 }}>{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Sign out */}
          <button
            onClick={() => { void fetch('/api/auth/logout', { method: 'POST' }).then(() => { window.location.href = '/' }) }}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', borderRadius: '10px', backgroundColor: '#1a1a1a', color: '#ef4444', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 500, textAlign: 'left', marginTop: '2px' }}
          >
            <LogOut size={18} />
            Sign out
          </button>
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

        {/* More button */}
        <button
          onClick={() => setDrawerOpen(o => !o)}
          style={tabStyle(drawerOpen)}
        >
          <Menu size={20} />
          More
        </button>
      </nav>
    </>
  )
}
