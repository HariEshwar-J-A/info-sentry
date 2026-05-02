'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
}

function RssIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 11a9 9 0 0 1 9 9" />
      <path d="M4 4a16 16 0 0 1 16 16" />
      <circle cx="5" cy="19" r="1" />
    </svg>
  )
}

function ChatIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function TagIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  )
}

function SparklesIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
      <path d="M19 17l.75 2.25L22 20l-2.25.75L19 23l-.75-2.25L16 20l2.25-.75L19 17z" />
      <path d="M5 17l.75 2.25L8 20l-2.25.75L5 23l-.75-2.25L2 20l2.25-.75L5 17z" />
    </svg>
  )
}

const navItems: NavItem[] = [
  { href: '/feed', label: 'Feed', icon: <RssIcon /> },
  { href: '/chat', label: 'Chat', icon: <ChatIcon /> },
  { href: '/topics', label: 'Topics', icon: <TagIcon /> },
  { href: '/surprise', label: 'Surprise Me', icon: <SparklesIcon /> },
]

interface BudgetData {
  spentUsd: number
  budgetUsd: number
  percent: number
}

export function Sidebar() {
  const pathname = usePathname()
  const [budget, setBudget] = useState<BudgetData | null>(null)

  useEffect(() => {
    fetch('/api/budget')
      .then((r) => r.json())
      .then((d) => setBudget(d))
      .catch(() => {})
  }, [])

  return (
    <aside
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '240px',
        height: '100vh',
        backgroundColor: '#0d0d0d',
        borderRight: '1px solid #1f1f1f',
        display: 'flex',
        flexDirection: 'column',
        padding: '0',
        zIndex: 100,
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: '24px 20px 20px',
          borderBottom: '1px solid #1a1a1a',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
            }}
          >
            ◉
          </div>
          <div>
            <div
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: '#f0f0f0',
                letterSpacing: '-0.02em',
              }}
            >
              Info-Sentry
            </div>
            <div style={{ fontSize: '11px', color: '#8a8a8a' }}>AI News Intelligence</div>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, padding: '12px 10px' }}>
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '9px 12px',
                borderRadius: '8px',
                marginBottom: '2px',
                fontSize: '14px',
                fontWeight: isActive ? 500 : 400,
                color: isActive ? '#f0f0f0' : '#8a8a8a',
                backgroundColor: isActive ? '#1a1a1a' : 'transparent',
                textDecoration: 'none',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  ;(e.currentTarget as HTMLAnchorElement).style.color = '#d0d0d0'
                  ;(e.currentTarget as HTMLAnchorElement).style.backgroundColor = '#141414'
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  ;(e.currentTarget as HTMLAnchorElement).style.color = '#8a8a8a'
                  ;(e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'transparent'
                }
              }}
            >
              <span style={{ color: isActive ? '#6366f1' : 'currentColor', opacity: isActive ? 1 : 0.7 }}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Budget indicator */}
      <div
        style={{
          padding: '16px 20px',
          borderTop: '1px solid #1a1a1a',
        }}
      >
        {budget ? (
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '6px',
              }}
            >
              <span style={{ fontSize: '11px', color: '#8a8a8a' }}>Monthly Budget</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor:
                      budget.percent > 80
                        ? '#ef4444'
                        : budget.percent > 60
                        ? '#eab308'
                        : '#22c55e',
                    animation: 'pulse-dot 2s ease-in-out infinite',
                  }}
                />
                <span
                  style={{
                    fontSize: '11px',
                    color:
                      budget.percent > 80
                        ? '#ef4444'
                        : budget.percent > 60
                        ? '#eab308'
                        : '#8a8a8a',
                  }}
                >
                  {Math.round(budget.percent)}%
                </span>
              </div>
            </div>
            <div
              style={{
                width: '100%',
                height: '3px',
                backgroundColor: '#1f1f1f',
                borderRadius: '3px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${budget.percent}%`,
                  height: '100%',
                  backgroundColor:
                    budget.percent > 80 ? '#ef4444' : budget.percent > 60 ? '#eab308' : '#6366f1',
                  borderRadius: '3px',
                  transition: 'width 0.3s',
                }}
              />
            </div>
            <div style={{ fontSize: '10px', color: '#555', marginTop: '4px' }}>
              ${budget.spentUsd.toFixed(2)} / ${budget.budgetUsd.toFixed(2)} USD
            </div>
          </div>
        ) : (
          <div style={{ height: '38px', backgroundColor: '#151515', borderRadius: '6px' }} />
        )}
      </div>
    </aside>
  )
}
