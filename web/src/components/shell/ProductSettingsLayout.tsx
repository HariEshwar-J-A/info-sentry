'use client'

import React, { useState, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, CheckCircle2, AlertCircle } from 'lucide-react'

interface Props {
  product: string
  children: React.ReactNode
  onSave?: () => Promise<void>
  isDirty?: boolean
}

export function ProductSettingsLayout({ product, children, onSave, isDirty = false }: Props) {
  const pathname = usePathname()
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const handleSave = useCallback(async () => {
    if (!onSave || saveStatus === 'saving') return
    setSaveStatus('saving')
    try {
      await onSave()
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch {
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    }
  }, [onSave, saveStatus])

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 24px' }}>
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 28, fontSize: 13, color: 'var(--text-muted)' }}>
        <Link href={`/${product}`} style={{ color: 'var(--violet-400)', textDecoration: 'none' }}>{product}</Link>
        <ChevronRight size={12} aria-hidden="true" />
        <span>Settings</span>
      </nav>

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 36 }}>
        <div>
          <h1 style={{
            fontFamily: 'Sora, sans-serif',
            fontSize: 28,
            fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
            marginBottom: 6,
          }}>
            {product} Settings
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Configure your {product} preferences</p>
        </div>

        {/* Save bar */}
        {onSave && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {saveStatus === 'saved' && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--positive)' }}>
                <CheckCircle2 size={14} aria-hidden="true" /> Saved
              </span>
            )}
            {saveStatus === 'error' && (
              <span role="alert" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--negative)' }}>
                <AlertCircle size={14} aria-hidden="true" /> Error saving
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={!isDirty || saveStatus === 'saving'}
              aria-busy={saveStatus === 'saving'}
              style={{
                padding: '8px 18px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                background: isDirty ? 'var(--violet-500)' : 'var(--surface-2)',
                color: isDirty ? '#fff' : 'var(--text-muted)',
                border: 'none',
                cursor: isDirty ? 'pointer' : 'not-allowed',
                transition: 'background 150ms',
              }}
            >
              {saveStatus === 'saving' ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        )}
      </div>

      {/* Settings content */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {children}
      </div>
    </div>
  )
}

/** A card section within a settings page */
export function SettingsCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section
      aria-labelledby={`settings-${title.toLowerCase().replace(/\s+/g, '-')}`}
      style={{
        padding: '24px',
        borderRadius: 12,
        border: '1px solid var(--border)',
        background: 'var(--surface)',
      }}
    >
      <h2
        id={`settings-${title.toLowerCase().replace(/\s+/g, '-')}`}
        style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: description ? 6 : 20 }}
      >
        {title}
      </h2>
      {description && <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>{description}</p>}
      {children}
    </section>
  )
}
