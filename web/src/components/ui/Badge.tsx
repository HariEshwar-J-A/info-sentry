'use client'

import React from 'react'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'accent' | 'positive' | 'negative' | 'neutral' | 'outline'
  size?: 'sm' | 'md'
  onClick?: () => void
  className?: string
}

const variantStyles: Record<string, React.CSSProperties> = {
  default: {
    backgroundColor: '#1f1f1f',
    color: '#8a8a8a',
    border: '1px solid #2a2a2a',
  },
  accent: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    color: '#6366f1',
    border: '1px solid rgba(99, 102, 241, 0.3)',
  },
  positive: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    color: '#22c55e',
    border: '1px solid rgba(34, 197, 94, 0.25)',
  },
  negative: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    color: '#ef4444',
    border: '1px solid rgba(239, 68, 68, 0.25)',
  },
  neutral: {
    backgroundColor: 'rgba(234, 179, 8, 0.12)',
    color: '#eab308',
    border: '1px solid rgba(234, 179, 8, 0.25)',
  },
  outline: {
    backgroundColor: 'transparent',
    color: '#8a8a8a',
    border: '1px solid #1f1f1f',
  },
}

export function Badge({
  children,
  variant = 'default',
  size = 'sm',
  onClick,
  className,
}: BadgeProps) {
  const style: React.CSSProperties = {
    ...variantStyles[variant],
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: '6px',
    fontSize: size === 'sm' ? '11px' : '13px',
    fontWeight: 500,
    padding: size === 'sm' ? '2px 8px' : '4px 10px',
    lineHeight: 1.4,
    cursor: onClick ? 'pointer' : 'default',
    transition: 'opacity 0.15s',
    userSelect: 'none',
  }

  if (onClick) {
    return (
      <span
        style={style}
        onClick={onClick}
        className={className}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick() }}
      >
        {children}
      </span>
    )
  }

  return (
    <span style={style} className={className}>
      {children}
    </span>
  )
}
