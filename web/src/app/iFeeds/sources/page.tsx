'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { TopBar } from '@/components/shell/TopBar'
import { SearchInput } from '@/components/ui/SearchInput'
import { SegmentTabs } from '@/components/ui/SegmentTabs'
import { LoadingState } from '@/components/ui/LoadingState'
import { Button } from '@/components/ui/Button'
import { FormInput } from '@/components/ui/FormInput'

// ─── Types ─────────────────────────────────────────────────

interface LinkedTopic { id: string; topic: string; isActive: boolean }

interface Source {
  id: string
  name: string
  url: string
  rssUrl: string | null
  type: string
  trustScore: number
  isActive: boolean
  articleCount: number
  lastArticleAt: string | null
  linkedTopics: LinkedTopic[]
  createdAt: string
}

// ─── Helpers ───────────────────────────────────────────────

function trustColor(s: number) {
  if (s >= 0.85) return '#6366f1'
  if (s >= 0.7)  return '#22c55e'
  if (s >= 0.5)  return '#eab308'
  if (s >= 0.3)  return '#f97316'
  return '#ef4444'
}
function trustLabel(s: number) {
  if (s >= 0.85) return 'Trusted'
  if (s >= 0.7)  return 'Good'
  if (s >= 0.5)  return 'Average'
  if (s >= 0.3)  return 'Low'
  return 'Unreliable'
}
function timeAgo(iso: string | null): string {
  if (!iso) return 'never'
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3_600_000)
  if (h > 24 * 7) return `${Math.floor(h / 24 / 7)}w ago`
  if (h > 24) return `${Math.floor(h / 24)}d ago`
  if (h > 0) return `${h}h ago`
  return 'just now'
}

// ─── Source Card ───────────────────────────────────────────

function SourceCard({ source, onUpdated, onDeleted }: {
  source: Source
  onUpdated: (s: Source) => void
  onDeleted: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(source.name)
  const [rssUrl, setRssUrl] = useState(source.rssUrl ?? '')
  const [trustScore, setTrustScore] = useState(source.trustScore)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showTopics, setShowTopics] = useState(false)

  async function save() {
    setSaving(true)
    const res = await fetch(`/api/sources/${source.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, rssUrl: rssUrl || null, trustScore }),
    })
    if (res.ok) {
      const { source: updated } = await res.json() as { source: Source }
      onUpdated({ ...source, ...updated, linkedTopics: source.linkedTopics })
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
      const { source: updated } = await res.json() as { source: Source }
      onUpdated({ ...source, ...updated, linkedTopics: source.linkedTopics })
    }
  }

  async function del() {
    if (!confirm(`Delete "${source.name}"? This will remove it from all topics.`)) return
    setDeleting(true)
    await fetch(`/api/sources/${source.id}`, { method: 'DELETE' })
    onDeleted(source.id)
  }

  const tc = trustColor(trustScore)
  const isGoogle = source.name.startsWith('Google News:')
  const isGitHub = source.url.includes('github.com')

  return (
    <div style={{
      backgroundColor: '#111',
      border: `1px solid ${source.isActive ? '#1f1f1f' : '#141414'}`,
      borderRadius: '12px',
      overflow: 'hidden',
      opacity: source.isActive ? 1 : 0.6,
    }}>
      {/* Main row */}
      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        {/* Trust bar */}
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', paddingTop: '3px' }}>
          <div style={{ width: '5px', height: '40px', borderRadius: '3px', background: '#1a1a1a', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            <div style={{ width: '100%', height: `${source.trustScore * 100}%`, backgroundColor: tc, borderRadius: '3px' }} />
          </div>
          <span style={{ fontSize: '9px', color: tc, fontWeight: 700 }}>{Math.round(source.trustScore * 100)}</span>
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {!editing ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '4px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#f0f0f0' }}>{source.name}</span>
                {source.rssUrl && <span style={{ fontSize: '9px', color: '#6366f1', backgroundColor: 'rgba(99,102,241,0.12)', borderRadius: '3px', padding: '1px 5px', fontWeight: 700 }}>RSS</span>}
                {isGoogle && <span style={{ fontSize: '9px', color: '#22c55e', backgroundColor: 'rgba(34,197,94,0.1)', borderRadius: '3px', padding: '1px 5px' }}>Google News</span>}
                {isGitHub && <span style={{ fontSize: '9px', color: '#eab308', backgroundColor: 'rgba(234,179,8,0.1)', borderRadius: '3px', padding: '1px 5px' }}>GitHub</span>}
                <span style={{ fontSize: '10px', color: tc }}>{trustLabel(source.trustScore)}</span>
                {!source.isActive && <span style={{ fontSize: '9px', color: '#555', backgroundColor: '#1a1a1a', borderRadius: '3px', padding: '1px 5px' }}>DISABLED</span>}
              </div>
              <a href={source.url} target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: '#555', textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '6px' }}>
                {source.url}
              </a>
              <div style={{ display: 'flex', gap: '14px', fontSize: '11px', color: '#555', flexWrap: 'wrap' }}>
                <span>{source.articleCount} articles</span>
                <span>last: {timeAgo(source.lastArticleAt)}</span>
                <button onClick={() => setShowTopics(!showTopics)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: source.linkedTopics.length > 0 ? '#6366f1' : '#555', fontSize: '11px', padding: 0 }}>
                  {source.linkedTopics.length} topic{source.linkedTopics.length !== 1 ? 's' : ''} {showTopics ? '▲' : '▼'}
                </button>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Name"
                  style={{ flex: '1 1 140px', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '6px', color: '#e0e0e0', fontSize: '12px', padding: '6px 10px', outline: 'none' }} />
                <input value={rssUrl} onChange={e => setRssUrl(e.target.value)} placeholder="RSS URL"
                  style={{ flex: '2 1 200px', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '6px', color: '#e0e0e0', fontSize: '12px', padding: '6px 10px', outline: 'none' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '11px', color: '#8a8a8a', minWidth: '70px' }}>Reliability</span>
                <input type="range" min="0" max="1" step="0.05" value={trustScore}
                  onChange={e => setTrustScore(parseFloat(e.target.value))}
                  style={{ flex: 1, accentColor: trustColor(trustScore) }} />
                <span style={{ fontSize: '12px', fontWeight: 700, color: trustColor(trustScore), minWidth: '80px' }}>
                  {Math.round(trustScore * 100)}% — {trustLabel(trustScore)}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => void save()} disabled={saving}
                  style={{ padding: '5px 14px', borderRadius: '6px', border: 'none', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
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

        {/* Actions */}
        {!editing && (
          <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
            <button onClick={() => setEditing(true)} style={{ padding: '4px 8px', borderRadius: '5px', border: '1px solid #2a2a2a', background: 'none', color: '#8a8a8a', cursor: 'pointer', fontSize: '11px' }}>Edit</button>
            <button onClick={() => void toggleActive()} style={{ padding: '4px 8px', borderRadius: '5px', border: '1px solid #2a2a2a', background: 'none', color: source.isActive ? '#8a8a8a' : '#6366f1', cursor: 'pointer', fontSize: '11px' }}>
              {source.isActive ? 'Disable' : 'Enable'}
            </button>
            <button onClick={() => void del()} disabled={deleting} style={{ padding: '4px 8px', borderRadius: '5px', border: '1px solid rgba(239,68,68,0.25)', background: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '11px' }}>
              {deleting ? '…' : 'Delete'}
            </button>
          </div>
        )}
      </div>

      {/* Topic relationships */}
      {showTopics && source.linkedTopics.length > 0 && (
        <div style={{ borderTop: '1px solid #1a1a1a', padding: '10px 16px', display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '10px', color: '#555', marginRight: '4px' }}>TOPICS:</span>
          {source.linkedTopics.map(t => (
            <Link key={t.id} href="/topics"
              style={{ fontSize: '11px', color: t.isActive ? '#a5b4fc' : '#555', backgroundColor: t.isActive ? 'rgba(99,102,241,0.1)' : '#1a1a1a', borderRadius: '4px', padding: '2px 8px', textDecoration: 'none' }}>
              {t.topic}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Add Source Form ───────────────────────────────────────

function AddSourceForm({ onAdded }: { onAdded: (s: Source) => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [rssUrl, setRssUrl] = useState('')
  const [trustScore, setTrustScore] = useState(0.7)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), url: url.trim(), rssUrl: rssUrl.trim() || undefined, trustScore }),
      })
      const data = await res.json() as { source?: Source; error?: string }
      if (!res.ok) { setError(data.error ?? 'Failed'); return }
      onAdded({ ...data.source!, linkedTopics: [], articleCount: 0, lastArticleAt: null })
      setName(''); setUrl(''); setRssUrl(''); setTrustScore(0.7); setOpen(false)
    } catch (err) { setError((err as Error).message) } finally { setLoading(false) }
  }

  if (!open) return (
    <Button variant="outline" onClick={() => setOpen(true)} style={{ width: '100%', justifyContent: 'center' }}>
      + Add Global Source
    </Button>
  )

  return (
    <form onSubmit={e => void handleAdd(e)} style={{ backgroundColor: '#111', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ fontSize: '13px', fontWeight: 600, color: '#f0f0f0', marginBottom: '4px' }}>Add New Source</div>
      <div className="form-grid-2col">
        <FormInput value={name} onChange={e => setName(e.target.value)} placeholder="Name (e.g. TechCrunch)" required label="Name" />
        <FormInput value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" required label="URL" />
      </div>
      <FormInput value={rssUrl} onChange={e => setRssUrl(e.target.value)} placeholder="RSS feed URL (optional — strongly recommended)" label="RSS URL" />
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '12px', color: '#8a8a8a', minWidth: '70px' }}>Reliability</span>
        <input type="range" min="0" max="1" step="0.05" value={trustScore}
          onChange={e => setTrustScore(parseFloat(e.target.value))}
          style={{ flex: 1, accentColor: trustColor(trustScore) }} />
        <span style={{ fontSize: '12px', fontWeight: 700, color: trustColor(trustScore), minWidth: '90px' }}>
          {Math.round(trustScore * 100)}% — {trustLabel(trustScore)}
        </span>
      </div>
      {error && <div style={{ fontSize: '12px', color: '#ef4444' }}>{error}</div>}
      <div style={{ display: 'flex', gap: '8px' }}>
        <Button type="submit" variant="primary" size="sm" disabled={loading || !url.trim() || !name.trim()} loading={loading}>
          {loading ? 'Adding…' : 'Add Source'}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  )
}

// ─── Main Page ─────────────────────────────────────────────

type FilterType = 'all' | 'WEB' | 'RSS' | 'API' | 'google' | 'github'

export default function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')

  const fetch_ = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/sources')
    if (res.ok) {
      const d = await res.json() as { sources: Source[] }
      setSources(d.sources)
    }
    setLoading(false)
  }, [])

  useEffect(() => { void fetch_() }, [fetch_])

  function handleUpdated(updated: Source) {
    setSources(prev => prev.map(s => s.id === updated.id ? { ...s, ...updated } : s))
  }
  function handleDeleted(id: string) { setSources(prev => prev.filter(s => s.id !== id)) }
  function handleAdded(s: Source) { setSources(prev => [s, ...prev]) }

  const filtered = sources.filter(s => {
    if (filter === 'google') return s.name.startsWith('Google News:')
    if (filter === 'github') return s.url.includes('github.com')
    if (filter !== 'all') return s.type === filter
    if (search) {
      const q = search.toLowerCase()
      return s.name.toLowerCase().includes(q) || s.url.toLowerCase().includes(q) ||
        s.linkedTopics.some(t => t.topic.toLowerCase().includes(q))
    }
    return true
  }).filter(s => {
    if (search && filter === 'all') {
      const q = search.toLowerCase()
      return s.name.toLowerCase().includes(q) || s.url.toLowerCase().includes(q) ||
        s.linkedTopics.some(t => t.topic.toLowerCase().includes(q))
    }
    return true
  })

  const active = filtered.filter(s => s.isActive)
  const disabled = filtered.filter(s => !s.isActive)

  const FILTERS: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'google', label: 'Google News' },
    { key: 'github', label: 'GitHub' },
    { key: 'WEB', label: 'Web/Blog' },
    { key: 'RSS', label: 'RSS' },
  ]

  const totalArticles = sources.reduce((sum, s) => sum + s.articleCount, 0)
  const totalTopicLinks = new Set(sources.flatMap(s => s.linkedTopics.map(t => t.id))).size

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
      <TopBar
        title="Sources"
        subtitle={`${sources.length} sources · ${totalArticles} articles · ${totalTopicLinks} topics covered`}
      />

      <div className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search sources, URLs, topics…"
            fullWidth
          />
          <SegmentTabs
            variant="pills"
            active={filter}
            onChange={id => id && setFilter(id)}
            items={FILTERS.map(f => ({ id: f.key, label: f.label }))}
          />
        </div>

        {/* Add source */}
        <AddSourceForm onAdded={handleAdded} />

        {loading ? (
          <LoadingState label="Loading sources…" />
        ) : (
          <>
            {/* Active sources */}
            <div>
              <div style={{ fontSize: '11px', color: '#555', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                Active ({active.length})
              </div>
              {active.length === 0 ? (
                <div style={{ color: '#444', fontSize: '13px' }}>No active sources match your filter.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {active.map(s => (
                    <SourceCard key={s.id} source={s} onUpdated={handleUpdated} onDeleted={handleDeleted} />
                  ))}
                </div>
              )}
            </div>

            {/* Disabled sources */}
            {disabled.length > 0 && (
              <div>
                <div style={{ fontSize: '11px', color: '#333', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                  Disabled ({disabled.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {disabled.map(s => (
                    <SourceCard key={s.id} source={s} onUpdated={handleUpdated} onDeleted={handleDeleted} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
