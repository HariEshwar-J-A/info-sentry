'use client'

import { useState, useEffect, useCallback } from 'react'
import { ProductSettingsLayout, SettingsCard } from '@/components/shell/ProductSettingsLayout'

type Settings = { cadence: 'daily' | 'weekly'; noveltyWeight: number }
const DEFAULTS: Settings = { cadence: 'daily', noveltyWeight: 0.6 }

export default function ISurpriseSettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS)
  const [initial, setInitial]   = useState<Settings>(DEFAULTS)
  const isDirty = JSON.stringify(settings) !== JSON.stringify(initial)

  useEffect(() => {
    fetch('/api/settings/iSurprise').then(r => r.json()).then(({ data }) => {
      if (data && typeof data === 'object') { const m = { ...DEFAULTS, ...data }; setSettings(m); setInitial(m) }
    }).catch(() => {})
  }, [])

  const save = useCallback(async () => {
    const res = await fetch('/api/settings/iSurprise', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) })
    if (!res.ok) throw new Error('Save failed')
    const { data } = await res.json(); const m = { ...DEFAULTS, ...data }; setInitial(m); setSettings(m)
  }, [settings])

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setSettings(prev => ({ ...prev, [k]: v }))

  return (
    <ProductSettingsLayout product="iSurprise" onSave={save} isDirty={isDirty}>
      <SettingsCard title="Surprise cadence" description="How often you want your iSurprise digest to refresh.">
        <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>Cadence</legend>
          {(['daily', 'weekly'] as const).map(c => (
            <label key={c} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 8, cursor: 'pointer', marginBottom: 8, border: `1px solid ${settings.cadence === c ? 'var(--violet-500)' : 'var(--border)'}`, background: settings.cadence === c ? 'rgba(139,92,246,0.08)' : 'var(--bg-elevated)' }}>
              <input type="radio" name="cadence" value={c} checked={settings.cadence === c} onChange={() => set('cadence', c)} style={{ accentColor: 'var(--violet-500)' }} />
              <span style={{ fontSize: 14, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{c}</span>
            </label>
          ))}
        </fieldset>
      </SettingsCard>
      <SettingsCard title="Novelty weight" description="Higher = more surprising (but possibly less relevant). Lower = safer but still outside your bubble.">
        <label htmlFor="novelty-weight" style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 10, display: 'block' }}>
          Novelty: <strong style={{ color: 'var(--text-primary)' }}>{(settings.noveltyWeight * 100).toFixed(0)}%</strong>
        </label>
        <input
          id="novelty-weight"
          type="range" min={0.2} max={1} step={0.05}
          value={settings.noveltyWeight}
          onChange={e => set('noveltyWeight', Number(e.target.value))}
          style={{ width: '100%', accentColor: 'var(--violet-500)' }}
          aria-label={`Novelty weight: ${(settings.noveltyWeight * 100).toFixed(0)}%`}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
          <span>Safer</span><span>Maximum surprise</span>
        </div>
      </SettingsCard>
    </ProductSettingsLayout>
  )
}
