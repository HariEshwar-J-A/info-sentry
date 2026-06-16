'use client'

import { useState, useEffect, useCallback } from 'react'
import { ProductSettingsLayout, SettingsCard } from '@/components/shell/ProductSettingsLayout'

type Settings = {
  notificationThreshold: number
  betaPredictions: boolean
  feedRefreshInterval: number
}

const DEFAULTS: Settings = { notificationThreshold: 0.7, betaPredictions: false, feedRefreshInterval: 30 }

export default function IFeedsSettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS)
  const [initial, setInitial]   = useState<Settings>(DEFAULTS)
  const isDirty = JSON.stringify(settings) !== JSON.stringify(initial)

  useEffect(() => {
    fetch('/api/settings/iFeeds').then(r => r.json()).then(({ data }) => {
      if (data && typeof data === 'object') {
        const merged = { ...DEFAULTS, ...data }
        setSettings(merged)
        setInitial(merged)
      }
    }).catch(() => {})
  }, [])

  const save = useCallback(async () => {
    const res = await fetch('/api/settings/iFeeds', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })
    if (!res.ok) throw new Error('Save failed')
    const { data } = await res.json()
    const merged = { ...DEFAULTS, ...data }
    setInitial(merged); setSettings(merged)
  }, [settings])

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) =>
    setSettings(prev => ({ ...prev, [k]: v }))

  return (
    <ProductSettingsLayout product="iFeeds" onSave={save} isDirty={isDirty}>
      <SettingsCard title="Notifications" description="Receive an alert when an article's relevance score exceeds this threshold.">
        <label htmlFor="notif-threshold" style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 10, display: 'block' }}>
          Threshold: <strong style={{ color: 'var(--text-primary)' }}>{(settings.notificationThreshold * 100).toFixed(0)}%</strong>
        </label>
        <input
          id="notif-threshold"
          type="range" min={0.3} max={1} step={0.05}
          value={settings.notificationThreshold}
          onChange={e => set('notificationThreshold', Number(e.target.value))}
          style={{ width: '100%', accentColor: 'var(--violet-500)' }}
          aria-label={`Notification threshold: ${(settings.notificationThreshold * 100).toFixed(0)}%`}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
          <span>30% (more alerts)</span><span>100% (fewer alerts)</span>
        </div>
      </SettingsCard>

      <SettingsCard title="Beta features">
        <label aria-label="Enable iPredictions" style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} htmlFor="beta-predictions">
          <input
            id="beta-predictions"
            type="checkbox"
            checked={settings.betaPredictions}
            onChange={e => set('betaPredictions', e.target.checked)}
            style={{ width: 18, height: 18, accentColor: 'var(--violet-500)' }}
          />
          <div>
            <span style={{ fontSize: 14, color: 'var(--text-primary)', display: 'block' }}>Enable iPredictions</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>AI forecasts with confidence scores and outcome tracking</span>
          </div>
        </label>
      </SettingsCard>
    </ProductSettingsLayout>
  )
}
