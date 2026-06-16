'use client'

import { useState } from 'react'
import Link from 'next/link'

const PRODUCTS = [
  { id: 'iFeeds',    name: 'iFeeds',    basePrice: 4,  icon: '◈' },
  { id: 'iGitHub',   name: 'iGitHub',   basePrice: 4,  icon: '⬡' },
  { id: 'iVideos',   name: 'iVideos',   basePrice: 6,  icon: '▷' },
  { id: 'iChat',     name: 'iChat',     basePrice: 8,  icon: '◌' },
  { id: 'iSurprise', name: 'iSurprise', basePrice: 2,  icon: '✦' },
]

const DISCOUNT = [0, 0, 0.10, 0.18, 0.24, 0.30]

export function BundleConfigurator() {
  const [selected, setSelected] = useState<Set<string>>(new Set(['iFeeds', 'iChat']))

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const count = selected.size
  const baseTotal = PRODUCTS.filter(p => selected.has(p.id)).reduce((s, p) => s + p.basePrice, 0)
  const discount = DISCOUNT[count] ?? 0
  const finalTotal = Math.round(baseTotal * (1 - discount) * 100) / 100

  return (
    <div>
      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}
        role="group"
        aria-label="Select products for your bundle"
      >
        {PRODUCTS.map(p => {
          const isOn = selected.has(p.id)
          return (
            <button
              key={p.id}
              onClick={() => toggle(p.id)}
              role="checkbox"
              aria-checked={isOn}
              aria-label={`${p.name} — $${p.basePrice}/mo`}
              style={{
                padding: '16px 14px',
                borderRadius: 10,
                border: isOn ? '2px solid var(--violet-400)' : '1px solid var(--border)',
                background: isOn ? 'rgba(139,92,246,0.1)' : 'var(--surface)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 150ms',
                position: 'relative',
              }}
            >
              <div style={{ fontSize: 22, marginBottom: 8 }}>{p.icon}</div>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>{p.name}</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>${p.basePrice}/mo</p>
              {isOn && (
                <div style={{
                  position: 'absolute', top: 10, right: 10,
                  width: 18, height: 18, borderRadius: '50%',
                  background: 'var(--violet-500)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, color: '#fff', fontWeight: 700,
                }}>✓</div>
              )}
            </button>
          )
        })}
      </div>

      {/* Price summary */}
      <div style={{
        marginTop: 24,
        padding: '20px 24px',
        borderRadius: 12,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
      }}>
        <div>
          {count === 0 ? (
            <p style={{ fontSize: 16, color: 'var(--text-muted)', margin: 0 }}>Select at least one product</p>
          ) : (
            <>
              <p style={{ fontSize: 28, fontFamily: 'Sora, sans-serif', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
                ${finalTotal}/mo
              </p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
                {count} product{count > 1 ? 's' : ''}
                {discount > 0 && <span style={{ color: 'var(--positive)', marginLeft: 8, fontWeight: 600 }}>−{Math.round(discount * 100)}% bundle discount</span>}
              </p>
            </>
          )}
        </div>
        <Link
          href={`/sentry/waitlist?bundle=${[...selected].join(',')}`}
          style={{
            padding: '11px 24px',
            borderRadius: 9,
            background: count > 0 ? 'var(--violet-500)' : 'var(--surface-2)',
            color: count > 0 ? '#fff' : 'var(--text-muted)',
            fontSize: 14,
            fontWeight: 600,
            textDecoration: 'none',
            border: '1px solid transparent',
            pointerEvents: count > 0 ? 'auto' : 'none',
          }}
          aria-disabled={count === 0}
          aria-label={count > 0 ? `Join waitlist for selected bundle: ${[...selected].join(', ')}` : 'Select products first'}
        >
          Join waitlist
        </Link>
      </div>
    </div>
  )
}
