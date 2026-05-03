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
  searchKeywords: string[]
  createdAt: string
  _count: { sources: number }
}

interface LogLine { type: 'stdout' | 'stderr' | 'system' | 'error'; text: string }

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

function AddTopicForm({ onAdded }: { onAdded: (topic: string) => void }) {
  const [topic, setTopic] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!topic.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/interests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.trim(), description: description.trim() || undefined }),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) { setError(data.error ?? 'Failed'); return }
      onAdded(topic.trim())
      setTopic('')
      setDescription('')
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
      {error && <div style={{ fontSize: '12px', color: '#ef4444' }}>{error}</div>}
    </form>
  )
}

// ─── Interest Card ─────────────────────────────────────────

function InterestCard({ interest, onRemove, onSeed }: {
  interest: Interest
  onRemove: () => void
  onSeed: (topic: string) => void
}) {
  const [removing, setRemoving] = useState(false)

  async function handleRemove() {
    setRemoving(true)
    await fetch(`/api/interests/${interest.id}`, { method: 'DELETE' })
    onRemove()
  }

  return (
    <div style={{ backgroundColor: '#111', border: '1px solid #1f1f1f', borderRadius: '12px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#f0f0f0' }}>{interest.topic}</span>
          {interest.isActive
            ? <span style={{ fontSize: '10px', color: '#22c55e', backgroundColor: 'rgba(34,197,94,0.12)', borderRadius: '4px', padding: '1px 6px', fontWeight: 700 }}>ACTIVE</span>
            : <span style={{ fontSize: '10px', color: '#555', backgroundColor: '#1a1a1a', borderRadius: '4px', padding: '1px 6px' }}>PAUSED</span>
          }
        </div>
        {interest.description && (
          <div style={{ fontSize: '12px', color: '#8a8a8a', marginBottom: '4px' }}>{interest.description}</div>
        )}
        <div style={{ fontSize: '11px', color: '#555' }}>
          {interest._count.sources} sources linked
          {interest.searchKeywords.length > 0 && ` · keywords: ${interest.searchKeywords.slice(0, 5).join(', ')}`}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
        <button
          onClick={() => onSeed(interest.topic)}
          style={{ padding: '5px 10px', borderRadius: '6px', border: 'none', background: 'rgba(99,102,241,0.15)', color: '#6366f1', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
          title="Run pipeline for this topic now"
        >
          ⚡ Seed
        </button>
        <button
          onClick={() => void handleRemove()}
          disabled={removing}
          style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid #2a2a2a', background: 'none', color: '#555', cursor: removing ? 'default' : 'pointer', fontSize: '11px' }}
        >
          {removing ? '…' : 'Remove'}
        </button>
      </div>
    </div>
  )
}

// ─── Seed Pipeline Panel ───────────────────────────────────

function SeedPanel({ topic, onDone }: { topic: string; onDone: () => void }) {
  const router = useRouter()
  const [logs, setLogs] = useState<LogLine[]>([])
  const [running, setRunning] = useState(true)
  const [articlesProcessed, setArticlesProcessed] = useState(0)

  useEffect(() => {
    const abort = new AbortController()
    void (async () => {
      try {
        const res = await fetch('/api/interests/seed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ includeVerifier: false }),
          signal: abort.signal,
        })
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buf = ''
        let count = 0
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
              setLogs((p) => [...p.slice(-500), line])
              // Count "Done:" lines from analyst as processed articles
              if (line.type === 'stdout' && line.text.includes('[analyst] Done:')) count++
            } catch { /* skip */ }
          }
        }
        setArticlesProcessed(count)
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setLogs((p) => [...p, { type: 'error', text: (err as Error).message }])
        }
      } finally {
        setRunning(false)
      }
    })()
    return () => abort.abort()
  }, [])

  function goToFeed() {
    router.push(`/feed?q=${encodeURIComponent(topic)}`)
  }

  return (
    <div style={{ backgroundColor: '#0d0d0d', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '12px', padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#6366f1' }}>
          {running
            ? <><span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#6366f1', animation: 'pulse 1s infinite', marginRight: '7px' }} />Seeding "{topic}"…</>
            : articlesProcessed > 0
              ? `✅ ${articlesProcessed} new article${articlesProcessed !== 1 ? 's' : ''} processed for "${topic}"`
              : `✅ Pipeline complete — existing articles are in the feed`}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {!running && (
            <>
              <button
                onClick={goToFeed}
                style={{ padding: '5px 12px', borderRadius: '6px', border: 'none', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
              >
                View Feed →
              </button>
              <button onClick={onDone} style={{ fontSize: '11px', color: '#555', background: 'none', border: 'none', cursor: 'pointer' }}>Dismiss</button>
            </>
          )}
        </div>
      </div>
      {!running && articlesProcessed === 0 && (
        <div style={{ fontSize: '12px', color: '#555', marginTop: '8px' }}>
          All recent articles were already processed. The feed already contains articles about your topics — use "View Feed" to search for "{topic}". New articles will appear on the next cron cycle (every 30 min).
        </div>
      )}
      <LogPanel lines={logs} onClear={() => setLogs([])} />
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
  const [seedingTopic, setSeedingTopic] = useState<string | null>(null)

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

  function handleTopicAdded(topic: string) {
    fetchInterests()
    setSeedingTopic(topic)
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

      <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {tab === 'interests' && (
          <>
            <div>
              <div style={{ fontSize: '12px', color: '#555', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>Add New Topic</div>
              <AddTopicForm onAdded={handleTopicAdded} />
              <div style={{ fontSize: '11px', color: '#444', marginTop: '6px' }}>
                New topics are linked to all active sources. A full pipeline (scout → analyst → predictor) runs immediately after adding.
              </div>
            </div>

            {seedingTopic && (
              <SeedPanel
                topic={seedingTopic}
                onDone={() => setSeedingTopic(null)}
              />
            )}

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
                        <InterestCard key={i.id} interest={i} onRemove={fetchInterests} onSeed={(t) => setSeedingTopic(t)} />
                      ))}
                    </div>
                  )}
                </div>

                {paused.length > 0 && (
                  <div>
                    <div style={{ fontSize: '12px', color: '#333', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>Paused ({paused.length})</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {paused.map((i) => (
                        <InterestCard key={i.id} interest={i} onRemove={fetchInterests} onSeed={(t) => setSeedingTopic(t)} />
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
