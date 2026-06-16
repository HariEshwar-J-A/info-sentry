'use client'

import { useState, useEffect, useCallback } from 'react'
import { ProductSettingsLayout, SettingsCard } from '@/components/shell/ProductSettingsLayout'

type Settings = { autoTranscribe: boolean; summaryLength: 'brief' | 'detailed' | 'full' }
const DEFAULTS: Settings = { autoTranscribe: false, summaryLength: 'detailed' }

export default function IVideosSettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS)
  const [initial, setInitial]   = useState<Settings>(DEFAULTS)
  const isDirty = JSON.stringify(settings) !== JSON.stringify(initial)

  useEffect(() => {
    fetch('/api/settings/iVideos').then(r => r.json()).then(({ data }) => {
      if (data && typeof data === 'object') { const m = { ...DEFAULTS, ...data }; setSettings(m); setInitial(m) }
    }).catch(() => {})
  }, [])

  const save = useCallback(async () => {
    const res = await fetch('/api/settings/iVideos', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) })
    if (!res.ok) throw new Error('Save failed')
    const { data } = await res.json()
    const m = { ...DEFAULTS, ...data }; setInitial(m); setSettings(m)
  }, [settings])

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setSettings(prev => ({ ...prev, [k]: v }))

  const LENGTHS: { id: Settings['summaryLength']; label: string; desc: string }[] = [
    { id: 'brief',    label: 'Brief',    desc: '2-3 sentences' },
    { id: 'detailed', label: 'Detailed', desc: '1-2 paragraphs (default)' },
    { id: 'full',     label: 'Full',     desc: 'Comprehensive section-by-section' },
  ]

  return (
    <ProductSettingsLayout product="iVideos" onSave={save} isDirty={isDirty}>
      <SettingsCard title="Auto-transcribe" description="Automatically generate transcripts for new videos from your channels.">
        <label aria-label="Auto-transcribe new videos" style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} htmlFor="auto-transcribe">
          <input id="auto-transcribe" type="checkbox" checked={settings.autoTranscribe} onChange={e => set('autoTranscribe', e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--violet-500)' }} />
          <div>
            <span style={{ fontSize: 14, color: 'var(--text-primary)', display: 'block' }}>Auto-transcribe new videos</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Uses AI compute — counts toward your monthly budget</span>
          </div>
        </label>
      </SettingsCard>
      <SettingsCard title="Summary length" description="Default AI summary detail level for transcribed videos.">
        <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>Summary length</legend>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {LENGTHS.map(l => (
              <label key={l.id} aria-label={l.label} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 8, cursor: 'pointer',
                border: `1px solid ${settings.summaryLength === l.id ? 'var(--violet-500)' : 'var(--border)'}`,
                background: settings.summaryLength === l.id ? 'rgba(139,92,246,0.08)' : 'var(--bg-elevated)',
              }}>
                <input type="radio" name="summary-length" value={l.id} checked={settings.summaryLength === l.id} onChange={() => set('summaryLength', l.id)} style={{ accentColor: 'var(--violet-500)' }} />
                <div>
                  <span style={{ fontSize: 14, color: 'var(--text-primary)', display: 'block' }}>{l.label}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{l.desc}</span>
                </div>
              </label>
            ))}
          </div>
        </fieldset>
      </SettingsCard>
    </ProductSettingsLayout>
  )
}
