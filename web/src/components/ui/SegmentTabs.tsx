'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { useReducedMotion } from '@/hooks/useReducedMotion'

interface TabItem<T extends string> {
  id: T
  label: string
  count?: number
}

interface SegmentTabsProps<T extends string> {
  items: TabItem<T>[]
  active: T | null
  onChange: (id: T | null) => void
  variant?: 'tabs' | 'pills'
  allowDeselect?: boolean
}

export function SegmentTabs<T extends string>({
  items,
  active,
  onChange,
  variant = 'pills',
  allowDeselect = false,
}: SegmentTabsProps<T>) {
  const prefersReduced = useReducedMotion()

  function handleClick(id: T) {
    if (allowDeselect && active === id) onChange(null)
    else onChange(id)
  }

  if (variant === 'tabs') {
    return (
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', gap: 0, position: 'relative' }}>
        {items.map(item => {
          const isActive = item.id === active
          return (
            <button
              key={item.id}
              onClick={() => handleClick(item.id)}
              style={{
                padding: '10px 16px',
                background: 'none',
                border: 'none',
                borderBottom: isActive || prefersReduced ? `2px solid ${isActive ? 'var(--violet-400)' : 'transparent'}` : '2px solid transparent',
                color: isActive ? 'var(--violet-300)' : 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: isActive ? 600 : 400,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'color 0.15s',
                marginBottom: '-1px',
                fontFamily: 'inherit',
                position: 'relative',
              }}
            >
              {item.label}
              {item.count !== undefined && (
                <span style={{
                  fontSize: '11px',
                  backgroundColor: isActive ? 'rgba(139,92,246,0.2)' : 'var(--surface)',
                  color: isActive ? 'var(--violet-300)' : 'var(--text-muted)',
                  borderRadius: '10px', padding: '1px 6px', fontWeight: 500,
                }}>
                  {item.count}
                </span>
              )}
              {/* Animated underline indicator */}
              {isActive && !prefersReduced && (
                <motion.span
                  layoutId="tab-indicator"
                  style={{
                    position: 'absolute', bottom: -1, left: 0, right: 0, height: 2,
                    backgroundColor: 'var(--violet-400)', borderRadius: '2px 2px 0 0',
                  }}
                  transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                />
              )}
            </button>
          )
        })}
      </div>
    )
  }

  // pills variant — animated background pill via layoutId
  return (
    <div className="pills-row">
      {items.map(item => {
        const isActive = item.id === active
        return (
          <button
            key={item.id}
            onClick={() => handleClick(item.id)}
            style={{
              padding: '5px 12px',
              borderRadius: '20px',
              border: `1px solid ${isActive ? 'var(--violet-500)' : 'var(--border)'}`,
              background: isActive && prefersReduced ? 'rgba(139,92,246,0.12)' : 'transparent',
              color: isActive ? 'var(--violet-300)' : 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: isActive ? 500 : 400,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              whiteSpace: 'nowrap',
              transition: 'border-color 0.15s, color 0.15s',
              fontFamily: 'inherit',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Animated fill background */}
            {isActive && !prefersReduced && (
              <motion.span
                layoutId="pill-bg"
                style={{
                  position: 'absolute', inset: 0, borderRadius: 'inherit',
                  backgroundColor: 'rgba(139,92,246,0.12)',
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              />
            )}
            <span style={{ position: 'relative', zIndex: 1 }}>{item.label}</span>
            {item.count !== undefined && (
              <span style={{ position: 'relative', zIndex: 1, color: isActive ? 'var(--violet-300)' : 'var(--text-muted)', fontSize: '11px' }}>
                {item.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
