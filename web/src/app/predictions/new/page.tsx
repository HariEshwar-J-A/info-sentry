'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/shell/TopBar'
import { ArrowLeft, Target } from 'lucide-react'
import Link from 'next/link'

const CATEGORIES = ['AI/Tech', 'Finance', 'Markets', 'Geopolitics', 'Science', 'Sports', 'Personal', 'Other']
const TIME_HORIZONS = ['1 week', '1 month', '3 months', '6 months', '1 year', '2+ years']

function confidenceColor(v: number): string {
  if (v >= 70) return '#22c55e'
  if (v >= 40) return '#eab308'
  return '#ef4444'
}

export default function NewPredictionPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    title: '',
    content: '',
    category: '',
    confidence: 60,
    timeHorizon: '3 months',
    dueDate: '',
    userContext: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function set(field: string, value: string | number) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          content: form.content,
          category: form.category || undefined,
          confidence: form.confidence,
          timeHorizon: form.timeHorizon || undefined,
          dueDate: form.dueDate || undefined,
          userContext: form.userContext || undefined,
        }),
      })

      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        setError(data.error ?? 'Failed to create prediction')
        return
      }

      router.push('/predictions')
    } catch {
      setError('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#0d0d0d', border: '1px solid #2a2a2a',
    borderRadius: '8px', color: '#f0f0f0', fontSize: '14px',
    padding: '10px 14px', outline: 'none', boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: '11px', color: '#666', fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px', display: 'block',
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
      <TopBar
        title="New Prediction"
        subtitle="What do you think will happen?"
        actions={
          <Link href="/predictions" style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: '#555', textDecoration: 'none' }}>
            <ArrowLeft size={14} /> Cancel
          </Link>
        }
      />

      <div className="page-content" style={{ maxWidth: '680px' }}>
        <form onSubmit={e => void handleSubmit(e)} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Title */}
          <div>
            <label style={labelStyle}>Prediction headline *</label>
            <input
              value={form.title}
              onChange={e => set('title', e.target.value)}
              maxLength={120}
              required
              placeholder="e.g. GPT-5 will be released before Q4 2026"
              style={inputStyle}
            />
            <div style={{ fontSize: '11px', color: '#444', marginTop: '4px', textAlign: 'right' }}>{form.title.length}/120</div>
          </div>

          {/* Full prediction */}
          <div>
            <label style={labelStyle}>Full prediction *</label>
            <textarea
              value={form.content}
              onChange={e => set('content', e.target.value)}
              required
              rows={4}
              placeholder="Describe exactly what you think will happen, and what would constitute this being true or false…"
              style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.6' }}
            />
          </div>

          {/* Category + Time horizon */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={labelStyle}>Category</label>
              <select
                value={form.category}
                onChange={e => set('category', e.target.value)}
                style={{ ...inputStyle, cursor: 'pointer', appearance: 'none' }}
              >
                <option value="">— None —</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Time horizon</label>
              <select
                value={form.timeHorizon}
                onChange={e => set('timeHorizon', e.target.value)}
                style={{ ...inputStyle, cursor: 'pointer', appearance: 'none' }}
              >
                {TIME_HORIZONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Confidence slider */}
          <div>
            <label style={labelStyle}>
              Your confidence —{' '}
              <span style={{ color: confidenceColor(form.confidence), fontWeight: 700 }}>{form.confidence}%</span>
            </label>
            <input
              type="range"
              min={5} max={95} step={5}
              value={form.confidence}
              onChange={e => set('confidence', parseInt(e.target.value, 10))}
              style={{ width: '100%', accentColor: confidenceColor(form.confidence), cursor: 'pointer', marginBottom: '6px' }}
            />
            <div style={{ height: '6px', borderRadius: '3px', backgroundColor: '#1a1a1a', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${form.confidence}%`, background: confidenceColor(form.confidence), borderRadius: '3px', transition: 'width 0.1s, background 0.2s' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#444', marginTop: '4px' }}>
              <span>Unlikely (5%)</span>
              <span>Certain (95%)</span>
            </div>
          </div>

          {/* Due date */}
          <div>
            <label style={labelStyle}>Due date (when should this resolve?)</label>
            <input
              type="date"
              value={form.dueDate}
              onChange={e => set('dueDate', e.target.value)}
              style={{ ...inputStyle, colorScheme: 'dark' }}
            />
          </div>

          {/* Context */}
          <div>
            <label style={labelStyle}>Context / reasoning <span style={{ color: '#444', textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
            <textarea
              value={form.userContext}
              onChange={e => set('userContext', e.target.value)}
              rows={3}
              placeholder="Why do you think this? What sources or signals informed this prediction?"
              style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.6' }}
            />
          </div>

          {error && (
            <div style={{ padding: '10px 14px', backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', fontSize: '13px', color: '#ef4444' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', paddingTop: '4px' }}>
            <button
              type="submit"
              disabled={submitting || !form.title.trim() || !form.content.trim()}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '10px 24px', borderRadius: '8px', border: 'none',
                background: form.title && form.content ? '#6366f1' : '#1a1a1a',
                color: form.title && form.content ? '#fff' : '#555',
                cursor: submitting || !form.title || !form.content ? 'default' : 'pointer',
                fontSize: '14px', fontWeight: 600,
              }}
            >
              <Target size={15} />
              {submitting ? 'Creating…' : 'Create Prediction'}
            </button>
            <Link href="/predictions" style={{ padding: '10px 18px', borderRadius: '8px', border: '1px solid #2a2a2a', color: '#8a8a8a', fontSize: '14px', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
