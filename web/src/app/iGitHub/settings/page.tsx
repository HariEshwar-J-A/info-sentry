'use client'

import { useState, useEffect, useCallback } from 'react'
import { ProductSettingsLayout, SettingsCard } from '@/components/shell/ProductSettingsLayout'

type Settings = { defaultLanguage: string; refreshInterval: number; showUnreadOnly: boolean }
const DEFAULTS: Settings = { defaultLanguage: '', refreshInterval: 90, showUnreadOnly: false }

export default function IGitHubSettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS)
  const [initial, setInitial]   = useState<Settings>(DEFAULTS)
  const isDirty = JSON.stringify(settings) !== JSON.stringify(initial)

  useEffect(() => {
    fetch('/api/settings/iGitHub').then(r => r.json()).then(({ data }) => {
      if (data && typeof data === 'object') { const m = { ...DEFAULTS, ...data }; setSettings(m); setInitial(m) }
    }).catch(() => {})
  }, [])

  const save = useCallback(async () => {
    const res = await fetch('/api/settings/iGitHub', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) })
    if (!res.ok) throw new Error('Save failed')
    const { data } = await res.json()
    const m = { ...DEFAULTS, ...data }; setInitial(m); setSettings(m)
  }, [settings])

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setSettings(prev => ({ ...prev, [k]: v }))

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-strong)',
    background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: 14, fontFamily: 'Inter, sans-serif', outline: 'none',
  }

  return (
    <ProductSettingsLayout product="iGitHub" onSave={save} isDirty={isDirty}>
      <SettingsCard title="Default language filter" description="Pre-filter the repo feed by programming language. Leave blank for all languages.">
        <label htmlFor="language-filter" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>Language filter</label>
        <input
          id="language-filter"
          type="text"
          value={settings.defaultLanguage}
          onChange={e => set('defaultLanguage', e.target.value)}
          placeholder="e.g. TypeScript, Python, Rust…"
          style={inputStyle}
        />
      </SettingsCard>
      <SettingsCard title="Refresh interval" description="How often the feed auto-refreshes when the page is focused.">
        <label htmlFor="refresh-interval" style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 10, display: 'block' }}>
          Every <strong style={{ color: 'var(--text-primary)' }}>{settings.refreshInterval}s</strong>
        </label>
        <input
          id="refresh-interval"
          type="range" min={30} max={300} step={30}
          value={settings.refreshInterval}
          onChange={e => set('refreshInterval', Number(e.target.value))}
          style={{ width: '100%', accentColor: 'var(--violet-500)' }}
          aria-label={`Refresh every ${settings.refreshInterval} seconds`}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
          <span>30s</span><span>5 min</span>
        </div>
      </SettingsCard>
      <SettingsCard title="Unread filter">
        <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} htmlFor="unread-only">
          <input id="unread-only" type="checkbox" checked={settings.showUnreadOnly} onChange={e => set('showUnreadOnly', e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--violet-500)' }} />
          <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Show only unread repos by default</span>
        </label>
      </SettingsCard>
    </ProductSettingsLayout>
  )
}
