'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/shell/TopBar'
import { TopicCluster } from '@/components/topics/TopicCluster'
import type { TopicCluster as TopicClusterType } from '@/lib/feed'

// ─── Types ─────────────────────────────────────────────────

interface Interest {
  id: string
  topic: string
  description: string | null
  score: number
  isActive: boolean
  trackNews: boolean
  trackGithub: boolean
  searchKeywords: string[]
  lastEngagedAt: string | null
  notificationThreshold: number
  createdAt: string
  _count: { sources: number }
}

interface Source {
  id: string
  name: string
  url: string
  rssUrl: string | null
  trustScore: number
  isActive: boolean
  type: string
}

interface LogLine { type: 'stdout' | 'stderr' | 'system' | 'error' | 'result'; text: string }

// ─── Helpers ───────────────────────────────────────────────

function trustColor(score: number): string {
  if (score >= 0.85) return '#6366f1'
  if (score >= 0.7)  return '#22c55e'
  if (score >= 0.5)  return '#eab308'
  if (score >= 0.3)  return '#f97316'
  return '#ef4444'
}

function trustLabel(score: number): string {
  if (score >= 0.85) return 'Trusted'
  if (score >= 0.7)  return 'Good'
  if (score >= 0.5)  return 'Average'
  if (score >= 0.3)  return 'Low'
  return 'Unreliable'
}

// ─── Source Row ────────────────────────────────────────────

function SourceRow({ source, interestId, onUpdated, onRemoved }: {
  source: Source
  interestId: string
  onUpdated: (s: Source) => void
  onRemoved: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(source.name)
  const [rssUrl, setRssUrl] = useState(source.rssUrl ?? '')
  const [trustScore, setTrustScore] = useState(source.trustScore)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)

  async function save() {
    setSaving(true)
    const res = await fetch(`/api/sources/${source.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, rssUrl: rssUrl || null, trustScore }),
    })
    if (res.ok) {
      const { source: updated } = (await res.json()) as { source: Source }
      onUpdated(updated)
      setEditing(false)
    }
    setSaving(false)
  }

  async function toggleActive() {
    const res = await fetch(`/api/sources/${source.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !source.isActive }),
    })
    if (res.ok) {
      const { source: updated } = (await res.json()) as { source: Source }
      onUpdated(updated)
    }
  }

  async function unlink() {
    setRemoving(true)
    await fetch(`/api/interests/${interestId}/sources/${source.id}`, { method: 'DELETE' })
    onRemoved(source.id)
  }

  const tc = trustColor(trustScore)

  return (
    <div style={{ backgroundColor: '#0d0d0d', border: `1px solid ${source.isActive ? '#1f1f1f' : '#141414'}`, borderRadius: '10px', padding: '12px 14px', opacity: source.isActive ? 1 : 0.55 }}>
      {!editing ? (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
          {/* Trust score indicator */}
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', paddingTop: '2px' }}>
            <div style={{ width: '6px', height: '36px', borderRadius: '3px', background: '#1a1a1a', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              <div style={{ width: '100%', height: `${trustScore * 100}%`, backgroundColor: tc, borderRadius: '3px', transition: 'height 0.3s' }} />
            </div>
            <span style={{ fontSize: '9px', color: tc, fontWeight: 700 }}>{Math.round(trustScore * 100)}</span>
          </div>

          {/* Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: source.isActive ? '#e0e0e0' : '#666' }}>{source.name}</span>
              {source.rssUrl && <span style={{ fontSize: '9px', color: '#6366f1', backgroundColor: 'rgba(99,102,241,0.12)', borderRadius: '3px', padding: '1px 5px', fontWeight: 700 }}>RSS</span>}
              <span style={{ fontSize: '10px', color: tc, fontWeight: 600 }}>{trustLabel(trustScore)}</span>
            </div>
            <a href={source.url} target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: '#555', textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {source.url}
            </a>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
            <button onClick={() => setEditing(true)} style={{ padding: '4px 8px', borderRadius: '5px', border: '1px solid #2a2a2a', background: 'none', color: '#8a8a8a', cursor: 'pointer', fontSize: '11px' }}>Edit</button>
            <button onClick={() => void toggleActive()} style={{ padding: '4px 8px', borderRadius: '5px', border: '1px solid #2a2a2a', background: 'none', color: source.isActive ? '#8a8a8a' : '#6366f1', cursor: 'pointer', fontSize: '11px' }}>
              {source.isActive ? 'Disable' : 'Enable'}
            </button>
            <button onClick={() => void unlink()} disabled={removing} style={{ padding: '4px 8px', borderRadius: '5px', border: '1px solid rgba(239,68,68,0.25)', background: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '11px' }}>
              {removing ? '…' : 'Unlink'}
            </button>
          </div>
        </div>
      ) : (
        /* Edit mode */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Source name"
              style={{ flex: '1 1 160px', background: '#111', border: '1px solid #3a3a3a', borderRadius: '6px', color: '#e0e0e0', fontSize: '12px', padding: '6px 10px', outline: 'none' }} />
            <input value={rssUrl} onChange={e => setRssUrl(e.target.value)} placeholder="RSS URL (optional)"
              style={{ flex: '2 1 220px', background: '#111', border: '1px solid #3a3a3a', borderRadius: '6px', color: '#e0e0e0', fontSize: '12px', padding: '6px 10px', outline: 'none' }} />
          </div>

          {/* Trust score slider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '11px', color: '#8a8a8a', minWidth: '80px' }}>Reliability</span>
            <input type="range" min="0" max="1" step="0.05" value={trustScore}
              onChange={e => setTrustScore(parseFloat(e.target.value))}
              style={{ flex: 1, accentColor: trustColor(trustScore), cursor: 'pointer' }} />
            <span style={{ fontSize: '12px', fontWeight: 700, color: trustColor(trustScore), minWidth: '80px' }}>
              {Math.round(trustScore * 100)}% — {trustLabel(trustScore)}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={() => void save()} disabled={saving}
              style={{ padding: '5px 14px', borderRadius: '6px', border: 'none', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => { setEditing(false); setName(source.name); setRssUrl(source.rssUrl ?? ''); setTrustScore(source.trustScore) }}
              style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid #2a2a2a', background: 'none', color: '#8a8a8a', cursor: 'pointer', fontSize: '12px' }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Add Source Form ───────────────────────────────────────

function AddSourceForm({ interestId, onAdded }: { interestId: string; onAdded: (s: Source) => void }) {
  const [url, setUrl] = useState('')
  const [rssUrl, setRssUrl] = useState('')
  const [name, setName] = useState('')
  const [trustScore, setTrustScore] = useState(0.7)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim()) return
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/interests/${interestId}/sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), rssUrl: rssUrl.trim() || undefined, name: name.trim() || undefined, trustScore }),
      })
      const data = await res.json() as { source?: Source; error?: string }
      if (!res.ok) { setError(data.error ?? 'Failed'); return }
      onAdded(data.source!)
      setUrl(''); setRssUrl(''); setName(''); setTrustScore(0.7)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const tc = trustColor(trustScore)

  return (
    <div style={{ border: '1px dashed #2a2a2a', borderRadius: '10px', overflow: 'hidden' }}>
      <button onClick={() => setExpanded(!expanded)}
        style={{ width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', color: '#6366f1', fontSize: '12px', fontWeight: 600, textAlign: 'left', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '14px' }}>+</span> Add Source {expanded ? '▲' : '▼'}
      </button>
      {expanded && (
        <form onSubmit={e => void handleAdd(e)} style={{ padding: '12px 14px', borderTop: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <input value={url} onChange={e => setUrl(e.target.value)} placeholder="Source URL (required)" required
              style={{ flex: '2 1 200px', background: '#111', border: '1px solid #2a2a2a', borderRadius: '6px', color: '#e0e0e0', fontSize: '12px', padding: '7px 10px', outline: 'none' }} />
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Name (auto from domain)"
              style={{ flex: '1 1 140px', background: '#111', border: '1px solid #2a2a2a', borderRadius: '6px', color: '#e0e0e0', fontSize: '12px', padding: '7px 10px', outline: 'none' }} />
          </div>
          <input value={rssUrl} onChange={e => setRssUrl(e.target.value)} placeholder="RSS feed URL (optional, greatly improves scraping)"
            style={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: '6px', color: '#e0e0e0', fontSize: '12px', padding: '7px 10px', outline: 'none' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '11px', color: '#8a8a8a', minWidth: '80px' }}>Reliability</span>
            <input type="range" min="0" max="1" step="0.05" value={trustScore}
              onChange={e => setTrustScore(parseFloat(e.target.value))}
              style={{ flex: 1, accentColor: tc, cursor: 'pointer' }} />
            <span style={{ fontSize: '12px', fontWeight: 700, color: tc, minWidth: '90px' }}>
              {Math.round(trustScore * 100)}% — {trustLabel(trustScore)}
            </span>
          </div>

          {error && <div style={{ fontSize: '11px', color: '#ef4444' }}>{error}</div>}
          <div>
            <button type="submit" disabled={loading || !url.trim()}
              style={{ padding: '6px 16px', borderRadius: '6px', border: 'none', background: loading || !url.trim() ? '#1a1a1a' : 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: loading || !url.trim() ? '#555' : '#fff', cursor: loading || !url.trim() ? 'default' : 'pointer', fontSize: '12px', fontWeight: 600 }}>
              {loading ? 'Adding…' : 'Add Source'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

// ─── Sources Panel ─────────────────────────────────────────

// ─── Discovery Panel ───────────────────────────────────────

interface DiscoveryResult {
  topic: string
  added: { name: string; url: string; rssUrl: string | null; trustScore: number }[]
  skipped: string[]
  totalCandidates: number
  slotsRemaining: number
  hardLimit: number
}

function DiscoveryPanel({ interestId, onDone }: { interestId: string; onDone: () => void }) {
  const [logs, setLogs] = useState<LogLine[]>([])
  const [running, setRunning] = useState(true)
  const [result, setResult] = useState<DiscoveryResult | null>(null)

  useEffect(() => {
    const abort = new AbortController()
    void (async () => {
      try {
        const res = await fetch(`/api/interests/${interestId}/discover`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dryRun: false }),
          signal: abort.signal,
        })
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buf = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          const parts = buf.split('\n')
          buf = parts.pop() ?? ''
          for (const part of parts) {
            if (!part.startsWith('data: ')) continue
            const raw = part.slice(6)
            if (raw === '[DONE]') break
            try {
              const line = JSON.parse(raw) as LogLine
              if (line.type === 'result') {
                const r = JSON.parse(line.text) as DiscoveryResult
                setResult(r)
              } else {
                setLogs(p => [...p.slice(-300), line])
              }
            } catch { /* skip */ }
          }
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError')
          setLogs(p => [...p, { type: 'error', text: (err as Error).message }])
      } finally {
        setRunning(false)
      }
    })()
    return () => abort.abort()
  }, [interestId])

  return (
    <div style={{ border: '1px solid rgba(99,102,241,0.3)', borderRadius: '10px', overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', backgroundColor: 'rgba(99,102,241,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#a5b4fc' }}>
          {running ? 'Discovering sources…' : 'Discovery complete'}
        </span>
        {!running && (
          <button onClick={onDone} style={{ fontSize: '11px', color: '#555', background: 'none', border: 'none', cursor: 'pointer' }}>Done</button>
        )}
      </div>

      {result && (
        <div style={{ padding: '10px 14px', borderTop: '1px solid #1a1a1a' }}>
          <div style={{ display: 'flex', gap: '16px', fontSize: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <span style={{ color: '#22c55e' }}>✓ {result.added.length} sources added</span>
            <span style={{ color: '#555' }}>{result.totalCandidates} domains discovered</span>
            <span style={{ color: '#555' }}>{result.slotsRemaining}/{result.hardLimit} slots remaining</span>
          </div>
          {result.added.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {result.added.map(s => (
                <div key={s.url} style={{ fontSize: '11px', color: '#8a8a8a', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ color: trustColor(s.trustScore) }}>●</span>
                  <span style={{ color: '#d0d0d0' }}>{s.name}</span>
                  {s.rssUrl && <span style={{ color: '#6366f1', fontSize: '9px', fontWeight: 700 }}>RSS</span>}
                  <span style={{ color: '#444' }}>{Math.round(s.trustScore * 100)}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <LogPanel lines={logs} onClear={() => setLogs([])} />
    </div>
  )
}

// ─── Sources Panel ─────────────────────────────────────────

type SourceFilter = 'all' | 'news' | 'github'

function SourcesPanel({ interestId }: { interestId: string }) {
  const [sources, setSources] = useState<Source[]>([])
  const [loading, setLoading] = useState(true)
  const [showDiscovery, setShowDiscovery] = useState(false)
  const [filter, setFilter] = useState<SourceFilter>('all')

  const loadSources = useCallback(() => {
    fetch(`/api/interests/${interestId}/sources`)
      .then(r => r.json())
      .then((d: { sources: Source[] }) => { setSources(d.sources ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [interestId])

  useEffect(() => { loadSources() }, [loadSources])

  function handleUpdated(updated: Source) {
    setSources(prev => prev.map(s => s.id === updated.id ? updated : s))
  }

  function handleRemoved(id: string) {
    setSources(prev => prev.filter(s => s.id !== id))
  }

  function handleAdded(source: Source) {
    setSources(prev => prev.some(s => s.id === source.id) ? prev : [...prev, source])
  }

  const githubSources = sources.filter(s => s.type === 'GITHUB')
  const newsSources = sources.filter(s => s.type !== 'GITHUB')
  const visible = filter === 'github' ? githubSources : filter === 'news' ? newsSources : sources
  const active = visible.filter(s => s.isActive)
  const disabled = visible.filter(s => !s.isActive)
  const atLimit = sources.length >= 50

  const filterTabStyle = (f: SourceFilter): React.CSSProperties => ({
    padding: '3px 9px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 500,
    background: filter === f ? 'rgba(99,102,241,0.2)' : 'none',
    color: filter === f ? '#a5b4fc' : '#555',
  })

  return (
    <div style={{ borderTop: '1px solid #1a1a1a', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
        <span style={{ fontSize: '11px', color: '#555', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Sources ({sources.length}/50) — {sources.filter(s => s.isActive).length} active
        </span>
        <button
          onClick={() => { setShowDiscovery(true) }}
          disabled={atLimit || showDiscovery}
          style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', background: atLimit ? '#1a1a1a' : 'rgba(99,102,241,0.15)', color: atLimit ? '#333' : '#6366f1', cursor: atLimit ? 'default' : 'pointer', fontSize: '11px', fontWeight: 600 }}
          title={atLimit ? 'Hard limit of 50 sources reached' : 'Auto-discover reliable sources from the internet'}
        >
          {atLimit ? 'Limit reached' : 'Discover Sources'}
        </button>
      </div>

      {/* Filter tabs */}
      {sources.length > 0 && (
        <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
          <button style={filterTabStyle('all')} onClick={() => setFilter('all')}>All ({sources.length})</button>
          <button style={filterTabStyle('news')} onClick={() => setFilter('news')}>News ({newsSources.length})</button>
          <button style={filterTabStyle('github')} onClick={() => setFilter('github')}>GitHub ({githubSources.length})</button>
        </div>
      )}

      {/* Auto-discovery panel */}
      {showDiscovery && (
        <DiscoveryPanel
          interestId={interestId}
          onDone={() => { setShowDiscovery(false); loadSources() }}
        />
      )}

      {loading ? (
        <div style={{ color: '#555', fontSize: '12px', padding: '8px 0' }}>Loading sources…</div>
      ) : sources.length === 0 ? (
        <div style={{ color: '#444', fontSize: '12px', padding: '4px 0' }}>No sources yet. Click "Discover Sources" to auto-find reliable domains, or add one manually below.</div>
      ) : visible.length === 0 ? (
        <div style={{ color: '#444', fontSize: '12px', padding: '4px 0' }}>
          {filter === 'github' ? 'No GitHub sources yet — run "GitHub" scan above.' : 'No news sources yet.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {active.map(s => (
            <SourceRow key={s.id} source={s} interestId={interestId} onUpdated={handleUpdated} onRemoved={handleRemoved} />
          ))}
          {disabled.length > 0 && (
            <>
              <div style={{ fontSize: '10px', color: '#333', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Disabled</div>
              {disabled.map(s => (
                <SourceRow key={s.id} source={s} interestId={interestId} onUpdated={handleUpdated} onRemoved={handleRemoved} />
              ))}
            </>
          )}
        </div>
      )}

      {!atLimit && filter !== 'github' && <AddSourceForm interestId={interestId} onAdded={handleAdded} />}
      {atLimit && <div style={{ fontSize: '11px', color: '#555', textAlign: 'center', padding: '8px 0' }}>Hard limit of 50 sources per topic reached. Remove some sources to add more.</div>}
    </div>
  )
}

// ─── Log Panel ─────────────────────────────────────────────

function LogPanel({ lines, onClear }: { lines: LogLine[]; onClear: () => void }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines])
  if (lines.length === 0) return null
  return (
    <div style={{ backgroundColor: '#050505', border: '1px solid #1a1a1a', borderRadius: '10px', overflow: 'hidden', marginTop: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid #1a1a1a', backgroundColor: '#0a0a0a' }}>
        <span style={{ fontSize: '11px', color: '#555', fontFamily: 'monospace' }}>Seed Output</span>
        <button onClick={onClear} style={{ fontSize: '11px', color: '#555', background: 'none', border: 'none', cursor: 'pointer' }}>Clear</button>
      </div>
      <div ref={scrollRef} style={{ maxHeight: '260px', overflowY: 'auto', padding: '10px 14px', fontFamily: 'monospace', fontSize: '12px', lineHeight: '1.6' }}>
        {lines.map((l, i) => (
          <div key={i} style={{ color: l.type === 'error' ? '#ef4444' : l.type === 'stderr' ? '#ef4444' : l.type === 'system' ? '#6366f1' : '#a0a0a0', marginBottom: '1px' }}>
            {l.type === 'system' ? `  ${l.text}` : l.type === 'stderr' ? `✗ ${l.text}` : `  ${l.text}`}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Add Topic Form ────────────────────────────────────────

function AddTopicForm({ onAdded }: { onAdded: (interest: Interest) => void }) {
  const [topic, setTopic] = useState('')
  const [description, setDescription] = useState('')
  const [trackNews, setTrackNews] = useState(true)
  const [trackGithub, setTrackGithub] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!topic.trim()) return
    if (!trackNews && !trackGithub) {
      setError('Select at least one topic type (News and/or GitHub)')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/interests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim(),
          description: description.trim() || undefined,
          trackNews,
          trackGithub,
        }),
      })
      const data = await res.json() as { interest?: Interest; error?: string }
      if (!res.ok) { setError(data.error ?? 'Failed'); return }
      if (data.interest) onAdded(data.interest)
      setTopic('')
      setDescription('')
      setTrackNews(true)
      setTrackGithub(false)
      inputRef.current?.focus()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <input
          ref={inputRef}
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="New topic (e.g. quantum computing)"
          style={{ flex: '1 1 200px', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '13px', padding: '8px 12px', outline: 'none' }}
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          style={{ flex: '1 1 200px', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '13px', padding: '8px 12px', outline: 'none' }}
        />
        <button
          type="submit"
          disabled={loading || !topic.trim()}
          style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', background: loading || !topic.trim() ? '#1a1a1a' : 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: loading || !topic.trim() ? '#555' : '#fff', cursor: loading || !topic.trim() ? 'default' : 'pointer', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap' }}
        >
          {loading ? 'Adding…' : '+ Add Topic'}
        </button>
      </div>
      <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
        <label style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12px', color: '#a0a0a0' }}>
          <input type="checkbox" checked={trackNews} onChange={(e) => setTrackNews(e.target.checked)} />
          Track news feed
        </label>
        <label style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12px', color: '#a0a0a0' }}>
          <input type="checkbox" checked={trackGithub} onChange={(e) => setTrackGithub(e.target.checked)} />
          Track GitHub repos
        </label>
      </div>
      {error && <div style={{ fontSize: '12px', color: '#ef4444' }}>{error}</div>}
    </form>
  )
}

// ─── Interest Card ─────────────────────────────────────────

function daysAgo(iso: string | null): number | null {
  if (!iso) return null
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

function InterestCard({ interest, onRemove, onRunCreated, onToggleTracking }: {
  interest: Interest
  onRemove: () => void
  onRunCreated: (runId: string) => void
  onToggleTracking: (interestId: string, patch: Partial<Pick<Interest, 'trackNews' | 'trackGithub'>>) => void
}) {
  const [removing, setRemoving] = useState(false)
  const [showSources, setShowSources] = useState(false)
  const [runningNews, setRunningNews] = useState(false)
  const [runningGithub, setRunningGithub] = useState(false)
  const [threshold, setThreshold] = useState(interest.notificationThreshold ?? 0.5)
  const thresholdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const staleDays = daysAgo(interest.lastEngagedAt)
  const isStale = staleDays !== null && staleDays >= 14

  function handleThresholdChange(val: number) {
    setThreshold(val)
    if (thresholdTimer.current) clearTimeout(thresholdTimer.current)
    thresholdTimer.current = setTimeout(() => {
      fetch(`/api/interests/${interest.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationThreshold: val }),
      }).catch(() => {})
    }, 600)
  }

  async function handleRemove() {
    setRemoving(true)
    await fetch(`/api/interests/${interest.id}`, { method: 'DELETE' })
    onRemove()
  }

  async function runNews() {
    setRunningNews(true)
    try {
      const res = await fetch(`/api/interests/${interest.id}/run-news`, { method: 'POST' })
      const data = await res.json() as { runId?: string }
      if (data.runId) onRunCreated(data.runId)
    } finally {
      setRunningNews(false)
    }
  }

  async function runGithub() {
    setRunningGithub(true)
    try {
      const res = await fetch(`/api/interests/${interest.id}/run-github`, { method: 'POST' })
      const data = await res.json() as { runId?: string }
      if (data.runId) onRunCreated(data.runId)
    } finally {
      setRunningGithub(false)
    }
  }

  async function updateTracking(patch: Partial<Pick<Interest, 'trackNews' | 'trackGithub'>>) {
    await fetch(`/api/interests/${interest.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    onToggleTracking(interest.id, patch)
  }

  return (
    <div style={{ backgroundColor: '#111', border: '1px solid #1f1f1f', borderRadius: '12px', overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#f0f0f0' }}>{interest.topic}</span>
            {interest.isActive
              ? <span style={{ fontSize: '10px', color: '#22c55e', backgroundColor: 'rgba(34,197,94,0.12)', borderRadius: '4px', padding: '1px 6px', fontWeight: 700 }}>ACTIVE</span>
              : <span style={{ fontSize: '10px', color: '#555', backgroundColor: '#1a1a1a', borderRadius: '4px', padding: '1px 6px' }}>PAUSED</span>
            }
            {isStale && (
              <span title={`No engagement in ${staleDays} days — score decays weekly`}
                style={{ fontSize: '10px', color: '#eab308', backgroundColor: 'rgba(234,179,8,0.1)', borderRadius: '4px', padding: '1px 6px', cursor: 'default' }}>
                idle {staleDays}d
              </span>
            )}
          </div>
          {interest.description && (
            <div style={{ fontSize: '12px', color: '#8a8a8a', marginBottom: '4px' }}>{interest.description}</div>
          )}
          {interest.searchKeywords.length > 0 && (
            <div style={{ fontSize: '11px', color: '#555' }}>keywords: {interest.searchKeywords.slice(0, 5).join(', ')}</div>
          )}
          {/* Notification threshold */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '10px', color: '#555', minWidth: '80px' }}>Notify ≥ {Math.round(threshold * 100)}% relevance</span>
            <input type="range" min={0} max={1} step={0.05} value={threshold}
              onChange={e => handleThresholdChange(parseFloat(e.target.value))}
              style={{ flex: 1, accentColor: '#6366f1', cursor: 'pointer', maxWidth: '120px' }}
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '5px', flexShrink: 0, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {interest.trackNews && (
            <button onClick={() => void runNews()}
              style={{ padding: '5px 10px', borderRadius: '6px', border: 'none', background: 'rgba(99,102,241,0.15)', color: '#6366f1', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}>
              {runningNews ? 'Running…' : 'Run News'}
            </button>
          )}
          {interest.trackGithub && (
            <button onClick={() => void runGithub()}
              style={{ padding: '5px 10px', borderRadius: '6px', border: 'none', background: 'rgba(234,179,8,0.12)', color: '#eab308', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}>
              {runningGithub ? 'Running…' : 'Run GitHub'}
            </button>
          )}
          <button onClick={() => { setShowSources(s => !s) }}
            style={{ padding: '5px 10px', borderRadius: '6px', border: `1px solid ${showSources ? '#6366f1' : '#2a2a2a'}`, background: showSources ? 'rgba(99,102,241,0.1)' : 'none', color: showSources ? '#a5b4fc' : '#8a8a8a', cursor: 'pointer', fontSize: '11px', fontWeight: 500 }}>
            Sources ({interest._count.sources})
          </button>
          <button onClick={() => void updateTracking({ trackNews: !interest.trackNews })}
            style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid #2a2a2a', background: 'none', color: interest.trackNews ? '#6366f1' : '#555', cursor: 'pointer', fontSize: '11px' }}>
            News: {interest.trackNews ? 'On' : 'Off'}
          </button>
          <button onClick={() => void updateTracking({ trackGithub: !interest.trackGithub })}
            style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid #2a2a2a', background: 'none', color: interest.trackGithub ? '#eab308' : '#555', cursor: 'pointer', fontSize: '11px' }}>
            GitHub: {interest.trackGithub ? 'On' : 'Off'}
          </button>
          <button onClick={() => void handleRemove()} disabled={removing}
            style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid #2a2a2a', background: 'none', color: '#555', cursor: removing ? 'default' : 'pointer', fontSize: '11px' }}>
            {removing ? '…' : 'Remove'}
          </button>
        </div>
      </div>
      {showSources && <SourcesPanel interestId={interest.id} />}
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────

export default function TopicsPage() {
  const [tab, setTab] = useState<'interests' | 'clusters'>('interests')
  const [interests, setInterests] = useState<Interest[]>([])
  const [clusters, setClusters] = useState<TopicClusterType[]>([])
  const [loadingInterests, setLoadingInterests] = useState(true)
  const [loadingClusters, setLoadingClusters] = useState(false)
  const router = useRouter()

  const fetchInterests = useCallback(() => {
    fetch('/api/interests')
      .then((r) => r.json())
      .then((d: { interests: Interest[] }) => { setInterests(d.interests ?? []); setLoadingInterests(false) })
      .catch(() => setLoadingInterests(false))
  }, [])

  const fetchClusters = useCallback(() => {
    setLoadingClusters(true)
    fetch('/api/topics')
      .then((r) => r.json())
      .then((d: TopicClusterType[]) => { setClusters(Array.isArray(d) ? d : []); setLoadingClusters(false) })
      .catch(() => setLoadingClusters(false))
  }, [])

  useEffect(() => { fetchInterests() }, [fetchInterests])
  useEffect(() => { if (tab === 'clusters') fetchClusters() }, [tab, fetchClusters])

  async function handleTopicAdded(interest: Interest) {
    fetchInterests()
    const runIds: string[] = []
    if (interest.trackNews) {
      const res = await fetch(`/api/interests/${interest.id}/run-news`, { method: 'POST' })
      const data = await res.json() as { runId?: string }
      if (data.runId) runIds.push(data.runId)
    }
    if (interest.trackGithub) {
      const res = await fetch(`/api/interests/${interest.id}/run-github`, { method: 'POST' })
      const data = await res.json() as { runId?: string }
      if (data.runId) runIds.push(data.runId)
    }
    if (runIds.length > 0) router.push(`/runs?focus=${encodeURIComponent(runIds[0])}`)
  }

  const active = interests.filter((i) => i.isActive)
  const paused = interests.filter((i) => !i.isActive)

  const tabBtn = (t: typeof tab): React.CSSProperties => ({
    padding: '6px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer',
    fontSize: '13px', fontWeight: 500,
    background: tab === t ? '#1a1a1a' : 'none',
    color: tab === t ? '#f0f0f0' : '#555',
  })

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
      <TopBar
        title="Topics"
        subtitle={`${active.length} active interests · ${clusters.length || '?'} clusters`}
        actions={
          <div style={{ display: 'flex', gap: '4px', backgroundColor: '#111', borderRadius: '8px', padding: '3px' }}>
            <button style={tabBtn('interests')} onClick={() => setTab('interests')}>My Interests</button>
            <button style={tabBtn('clusters')} onClick={() => setTab('clusters')}>Topic Clusters</button>
          </div>
        }
      />

      <div className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {tab === 'interests' && (
          <>
            <div>
              <div style={{ fontSize: '12px', color: '#555', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>Add New Topic</div>
              <AddTopicForm onAdded={handleTopicAdded} />
              <div style={{ fontSize: '11px', color: '#444', marginTop: '6px' }}>
                Choose whether each topic tracks News and/or GitHub. New topics start only their selected pipeline(s).
              </div>
            </div>

            {loadingInterests ? (
              <div style={{ color: '#555', fontSize: '14px', padding: '20px 0' }}>Loading…</div>
            ) : (
              <>
                <div>
                  <div style={{ fontSize: '12px', color: '#555', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>Active ({active.length})</div>
                  {active.length === 0 ? (
                    <div style={{ color: '#444', fontSize: '13px', padding: '16px 0' }}>No active interests yet — add one above.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {active.map((i) => (
                        <InterestCard
                          key={i.id}
                          interest={i}
                          onRemove={fetchInterests}
                          onRunCreated={(runId) => router.push(`/runs?focus=${encodeURIComponent(runId)}`)}
                          onToggleTracking={(interestId, patch) => setInterests((prev) => prev.map((it) => it.id === interestId ? { ...it, ...patch } : it))}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {paused.length > 0 && (
                  <div>
                    <div style={{ fontSize: '12px', color: '#333', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>Paused ({paused.length})</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {paused.map((i) => (
                        <InterestCard
                          key={i.id}
                          interest={i}
                          onRemove={fetchInterests}
                          onRunCreated={(runId) => router.push(`/runs?focus=${encodeURIComponent(runId)}`)}
                          onToggleTracking={(interestId, patch) => setInterests((prev) => prev.map((it) => it.id === interestId ? { ...it, ...patch } : it))}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {tab === 'clusters' && (
          <>
            {loadingClusters ? (
              <div style={{ color: '#555', fontSize: '14px', padding: '40px 0' }}>Loading clusters…</div>
            ) : clusters.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px 0', color: '#555' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>◎</div>
                <div style={{ fontSize: '14px' }}>No topic clusters yet</div>
                <div style={{ fontSize: '12px', marginTop: '6px', color: '#444' }}>Articles need to be analysed first</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {clusters.map((cluster) => (
                  <TopicCluster key={cluster.topic} cluster={cluster} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
