'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const PRIMARY_NAV = [
  { href: '/feed',        label: 'Feed',    icon: <RssIcon /> },
  { href: '/github-feed', label: 'GitHub',  icon: <StarIcon /> },
  { href: '/topics',      label: 'Topics',  icon: <TagIcon /> },
  { href: '/predictions', label: 'Predict', icon: <TargetIcon /> },
]

const MORE_NAV = [
  { href: '/sources',   label: 'Sources',     icon: <DbIcon /> },
  { href: '/chat',      label: 'Chat',        icon: <ChatIcon /> },
  { href: '/surprise',  label: 'Surprise',    icon: <SparkIcon /> },
  { href: '/settings',  label: 'Settings',    icon: <GearIcon /> },
]

export function BottomNav() {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)

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

  return (
    <>
      {/* Drawer overlay */}
      {drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 98 }}
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

          {/* Sign out */}
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
            <SignOutIcon />
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
          <MenuIcon />
          More
        </button>
      </nav>
    </>
  )
}

// ── Icons ──────────────────────────────────────────────────
function RssIcon()    { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/></svg> }
function StarIcon()   { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg> }
function TagIcon()    { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg> }
function TargetIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg> }
function DbIcon()     { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg> }
function ChatIcon()   { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> }
function SparkIcon()  { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/></svg> }
function GearIcon()   { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> }
function MenuIcon()   { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg> }
function SignOutIcon(){ return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg> }
