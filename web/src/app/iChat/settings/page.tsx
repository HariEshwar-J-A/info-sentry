'use client'

import { useState, useEffect, useCallback } from 'react'
import { ProductSettingsLayout, SettingsCard } from '@/components/shell/ProductSettingsLayout'

const MODELS = [
  { id: 'auto',           label: 'Auto (recommended)' },
  { id: 'fast',           label: 'Fast — lower cost' },
  { id: 'balanced',       label: 'Balanced' },
  { id: 'premium',        label: 'Premium — highest quality' },
]

type Settings = {
  model: string
  systemPrompt: string
  historyRetention: number
  includeNewsContext: boolean
}

const DEFAULTS: Settings = {
  model: 'auto',
  systemPrompt: '',
  historyRetention: 90,
  includeNewsContext: false,
}

export default function IChatSettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS)
  const [initial, setInitial]   = useState<Settings>(DEFAULTS)
  const isDirty = JSON.stringify(settings) !== JSON.stringify(initial)

  useEffect(() => {
    fetch('/api/settings/iChat')
      .then(r => r.json())
      .then(({ data }) => {
        if (data && typeof data === 'object') {
          const merged = { ...DEFAULTS, ...data }
          setSettings(merged)
          setInitial(merged)
        }
      })
      .catch(() => {})
  }, [])

  const save = useCallback(async () => {
    const res = await fetch('/api/settings/iChat', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })
    if (!res.ok) throw new Error('Save failed')
    const { data } = await res.json()
    const merged = { ...DEFAULTS, ...data }
    setInitial(merged)
    setSettings(merged)
  }, [settings])

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) =>
    setSettings(prev => ({ ...prev, [k]: v }))

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 8,
    border: '1px solid var(--border-strong)',
    background: 'var(--bg-elevated)',
    color: 'var(--text-primary)',
    fontSize: 14,
    fontFamily: 'Inter, sans-serif',
    outline: 'none',
    boxSizing: 'border-box',
  }

  return (
    <ProductSettingsLayout product="iChat" onSave={save} isDirty={isDirty}>
      <SettingsCard title="AI Model" description="Select the model for your conversations. Auto adapts based on task complexity.">
        <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>AI Model selection</legend>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {MODELS.map(m => (
              <label
                key={m.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 14px',
                  borderRadius: 8,
                  border: `1px solid ${settings.model === m.id ? 'var(--violet-500)' : 'var(--border)'}`,
                  background: settings.model === m.id ? 'rgba(139,92,246,0.08)' : 'var(--bg-elevated)',
                  cursor: 'pointer',
                  transition: 'all 150ms',
                }}
              >
                <input
                  type="radio"
                  name="model"
                  value={m.id}
                  checked={settings.model === m.id}
                  onChange={() => set('model', m.id)}
                  style={{ accentColor: 'var(--violet-500)' }}
                />
                <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>{m.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </SettingsCard>

      <SettingsCard title="System Prompt" description="Optional custom instructions appended to every conversation.">
        <label htmlFor="system-prompt" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>System prompt</label>
        <textarea
          id="system-prompt"
          value={settings.systemPrompt}
          onChange={e => set('systemPrompt', e.target.value)}
          placeholder="You are a helpful assistant that specialises in…"
          rows={4}
          style={{ ...inputStyle, resize: 'vertical' }}
          aria-describedby="system-prompt-hint"
        />
        <p id="system-prompt-hint" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
          Leave blank to use the default system prompt.
        </p>
      </SettingsCard>

      <SettingsCard title="History retention" description="How many days to keep conversation history.">
        <label htmlFor="history-retention" style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 10, display: 'block' }}>
          Retain for <strong style={{ color: 'var(--text-primary)' }}>{settings.historyRetention} days</strong>
        </label>
        <input
          id="history-retention"
          type="range"
          min={7} max={365} step={7}
          value={settings.historyRetention}
          onChange={e => set('historyRetention', Number(e.target.value))}
          style={{ width: '100%', accentColor: 'var(--violet-500)' }}
          aria-label={`History retention: ${settings.historyRetention} days`}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
          <span>7 days</span><span>365 days</span>
        </div>
      </SettingsCard>

      <SettingsCard title="News context" description="Automatically include recent iFeeds articles as context in new conversations.">
        <label
          style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
          htmlFor="news-context"
        >
          <input
            id="news-context"
            type="checkbox"
            checked={settings.includeNewsContext}
            onChange={e => set('includeNewsContext', e.target.checked)}
            style={{ width: 18, height: 18, accentColor: 'var(--violet-500)' }}
          />
          <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            Include my latest iFeeds articles as chat context
          </span>
        </label>
      </SettingsCard>
    </ProductSettingsLayout>
  )
}
