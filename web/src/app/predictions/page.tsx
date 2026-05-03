'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { TopBar } from '@/components/shell/TopBar'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'

interface TrackedPrediction {
  id: string
  content: string
  confidence: number
  timeHorizon: string | null
  status: string
  trackedAt: string | null
  dueDate: string | null
  resolutionAnalysis: string | null
  viewedAt: string | null
  article: { id: string; title: string; url: string }
}

interface VerifiedPrediction extends TrackedPrediction {
  resolvedAt: string | null
  createdAt: string
}

interface Stats {
  total: number
  correct: number
  incorrect: number
  partial: number
  accuracyRate: number
  byConfidence: { bucket: string; total: number; correct: number; partial: number; rate: number }[]
  byTopic: { topic: string; total: number; correct: number; partial: number; rate: number }[]
}

const statusColor: Record<string, string> = {
  PENDING: '#8a8a8a', CORRECT: '#22c55e', INCORRECT: '#ef4444', PARTIALLY_CORRECT: '#eab308',
}
const statusVariant: Record<string, 'positive' | 'negative' | 'neutral' | 'accent' | 'default'> = {
  PENDING: 'neutral', CORRECT: 'positive', INCORRECT: 'negative', PARTIALLY_CORRECT: 'accent', EXPIRED: 'default',
}
const verdictIcon: Record<string, string> = {
  CORRECT: '✅', INCORRECT: '❌', PARTIALLY_CORRECT: '🔶',
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function AnalysisBlock({ text }: { text: string }) {
  return (
    <div style={{ backgroundColor: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '10px', padding: '14px 16px', fontSize: '13px', lineHeight: '1.65', color: '#c0c0c0' }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p style={{ margin: '4px 0', color: '#c0c0c0' }}>{children}</p>,
          strong: ({ children }) => <strong style={{ color: '#f0f0f0', fontWeight: 600 }}>{children}</strong>,
          ul: ({ children }) => <ul style={{ paddingLeft: '16px', margin: '6px 0' }}>{children}</ul>,
          li: ({ children }) => <li style={{ marginBottom: '3px', color: '#c0c0c0' }}>{children}</li>,
          code: ({ children }) => <code style={{ backgroundColor: '#1a1a1a', borderRadius: '3px', padding: '1px 5px', fontSize: '12px', color: '#a5b4fc' }}>{children}</code>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}

export default function PredictionsPage() {
  const [tab, setTab] = useState<'tracked' | 'verifications' | 'stats'>('tracked')
  const [tracked, setTracked] = useState<TrackedPrediction[]>([])
  const [verified, setVerified] = useState<VerifiedPrediction[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [resolving, setResolving] = useState<string | null>(null)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Filters
  const [showUnreadOnly, setShowUnreadOnly] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | 'PENDING' | 'resolved'>('all')

  useEffect(() => {
    setLoading(true)
    if (tab === 'tracked') {
      fetch('/api/predictions/tracked')
        .then(r => r.json())
        .then(d => { setTracked(d as TrackedPrediction[]); setLoading(false) })
        .catch(() => setLoading(false))
    } else if (tab === 'verifications') {
      fetch('/api/predictions/verified')
        .then(r => r.json())
        .then(d => { setVerified(d as VerifiedPrediction[]); setLoading(false) })
        .catch(() => setLoading(false))
    } else {
      fetch('/api/predictions/stats')
        .then(r => r.json())
        .then(d => { setStats(d as Stats); setLoading(false) })
        .catch(() => setLoading(false))
    }
  }, [tab])

  async function resolve(id: string, resolution: 'CORRECT' | 'INCORRECT' | 'PARTIALLY_CORRECT') {
    setResolving(id); setOpenMenu(null)
    try {
      const res = await fetch(`/api/predictions/${id}/resolve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resolution }),
      })
      if (res.ok) {
        const { resolutionAnalysis } = (await res.json()) as { resolutionAnalysis: string }
        setTracked(prev => prev.map(p => p.id === id ? { ...p, status: resolution, resolutionAnalysis } : p))
      }
    } finally { setResolving(null) }
  }

  const filteredTracked = useMemo(() => {
    return tracked.filter(p => {
      if (showUnreadOnly && p.viewedAt) return false
      if (statusFilter === 'PENDING' && p.status !== 'PENDING') return false
      if (statusFilter === 'resolved' && p.status === 'PENDING') return false
      return true
    })
  }, [tracked, showUnreadOnly, statusFilter])

  const unreadTrackedCount = useMemo(() => tracked.filter(p => !p.viewedAt).length, [tracked])
  const unreadVerifiedCount = useMemo(() => verified.filter(p => !p.viewedAt).length, [verified])

  const TABS = [
    { id: 'tracked' as const, label: '📌 Tracked', badge: unreadTrackedCount },
    { id: 'verifications' as const, label: '🔮 Verifications', badge: unreadVerifiedCount },
    { id: 'stats' as const, label: '📊 Accuracy', badge: 0 },
  ]

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
      <TopBar title="Predictions" subtitle="Track, verify, and learn from AI predictions" />

      <div style={{ padding: '24px 32px' }}>
        {/* Tab bar */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', backgroundColor: '#111', border: '1px solid #1f1f1f', borderRadius: '10px', padding: '4px', width: 'fit-content' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ padding: '7px 18px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 500, backgroundColor: tab === t.id ? '#1f1f1f' : 'transparent', color: tab === t.id ? '#f0f0f0' : '#8a8a8a', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {t.label}
              {t.badge > 0 && (
                <span style={{ minWidth: '16px', height: '16px', borderRadius: '8px', backgroundColor: '#6366f1', color: '#fff', fontSize: '10px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading && <div style={{ color: '#555', fontSize: '14px', padding: '40px 0' }}>Loading…</div>}

        {/* ─── TRACKED TAB ─── */}
        {!loading && tab === 'tracked' && (
          <div>
            {/* Filters */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
              <button onClick={() => setShowUnreadOnly(!showUnreadOnly)}
                style={{ padding: '5px 12px', borderRadius: '6px', border: `1px solid ${showUnreadOnly ? '#6366f1' : '#2a2a2a'}`, background: showUnreadOnly ? 'rgba(99,102,241,0.12)' : 'none', color: showUnreadOnly ? '#6366f1' : '#8a8a8a', cursor: 'pointer', fontSize: '12px', fontWeight: 500, transition: 'all 0.15s' }}>
                {showUnreadOnly ? '● Unread only' : '○ Show unread only'}
              </button>
              <div style={{ width: '1px', height: '18px', backgroundColor: '#1f1f1f' }} />
              {(['all', 'PENDING', 'resolved'] as const).map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  style={{ padding: '5px 12px', borderRadius: '6px', border: `1px solid ${statusFilter === s ? '#6366f1' : '#2a2a2a'}`, background: statusFilter === s ? 'rgba(99,102,241,0.12)' : 'none', color: statusFilter === s ? '#6366f1' : '#8a8a8a', cursor: 'pointer', fontSize: '12px', fontWeight: 500, transition: 'all 0.15s' }}>
                  {s === 'all' ? 'All' : s === 'PENDING' ? '⏳ Pending' : '✓ Resolved'}
                </button>
              ))}
              <span style={{ fontSize: '12px', color: '#555', marginLeft: '4px' }}>
                {filteredTracked.length} of {tracked.length}
              </span>
            </div>

            {filteredTracked.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px 0', color: '#555' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>🎯</div>
                <div style={{ fontSize: '14px' }}>{tracked.length === 0 ? 'No tracked predictions yet' : 'No predictions match your filters'}</div>
                {tracked.length === 0 && <div style={{ fontSize: '12px', color: '#444', marginTop: '6px' }}>Track predictions from article pages</div>}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {filteredTracked.map((pred) => (
                  <div key={pred.id} style={{ backgroundColor: '#111', border: `1px solid ${(statusColor[pred.status] ?? '#1f1f1f')}33`, borderRadius: '12px', padding: '18px 20px' }}>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                      {!pred.viewedAt && <span style={{ fontSize: '10px', fontWeight: 700, color: '#6366f1', backgroundColor: 'rgba(99,102,241,0.12)', borderRadius: '4px', padding: '1px 5px' }}>● NEW</span>}
                      <Badge variant={statusVariant[pred.status] ?? 'default'} size="sm">{pred.status.replace(/_/g, ' ')}</Badge>
                      {pred.timeHorizon && <Badge variant="default" size="sm">{pred.timeHorizon}</Badge>}
                      {pred.dueDate && <Badge variant="default" size="sm">Due {formatDate(pred.dueDate)}</Badge>}
                      <Link href={`/article/${pred.article.id}`} style={{ marginLeft: 'auto', fontSize: '11px', color: '#6366f1', textDecoration: 'none', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {pred.article.title}
                      </Link>
                    </div>

                    <p style={{ fontSize: '14px', color: '#e0e0e0', lineHeight: '1.6', margin: '0 0 12px' }}>{pred.content}</p>

                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '11px', color: '#8a8a8a' }}>Confidence</span>
                        <span style={{ fontSize: '11px', color: pred.confidence > 0.7 ? '#22c55e' : pred.confidence > 0.5 ? '#eab308' : '#ef4444', fontWeight: 600 }}>{Math.round(pred.confidence * 100)}%</span>
                      </div>
                      <ProgressBar value={pred.confidence} max={1} color={pred.confidence > 0.7 ? '#22c55e' : pred.confidence > 0.5 ? '#eab308' : '#ef4444'} height={4} />
                    </div>

                    {pred.resolutionAnalysis && (
                      <div style={{ marginBottom: '10px' }}><AnalysisBlock text={pred.resolutionAnalysis} /></div>
                    )}

                    {pred.status === 'PENDING' && (
                      <div style={{ position: 'relative', display: 'inline-block' }}>
                        <button onClick={() => setOpenMenu(openMenu === pred.id ? null : pred.id)} disabled={resolving === pred.id}
                          style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '6px', border: '1px solid #6366f1', background: 'rgba(99,102,241,0.1)', color: '#6366f1', cursor: 'pointer' }}>
                          {resolving === pred.id ? 'Resolving…' : 'Resolve ▾'}
                        </button>
                        {openMenu === pred.id && (
                          <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 50, marginTop: '4px', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '4px', minWidth: '150px', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>
                            {(['CORRECT', 'PARTIALLY_CORRECT', 'INCORRECT'] as const).map(r => (
                              <button key={r} onClick={() => void resolve(pred.id, r)}
                                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', background: 'none', border: 'none', color: r === 'CORRECT' ? '#22c55e' : r === 'INCORRECT' ? '#ef4444' : '#eab308', cursor: 'pointer', fontSize: '13px', borderRadius: '5px' }}>
                                {r === 'CORRECT' ? '✓ Correct' : r === 'INCORRECT' ? '✗ Incorrect' : '≈ Partial'}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── VERIFICATIONS TAB ─── */}
        {!loading && tab === 'verifications' && (
          <div>
            {verified.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px 0', color: '#555' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔮</div>
                <div style={{ fontSize: '14px' }}>No verified predictions yet</div>
                <div style={{ fontSize: '12px', color: '#444', marginTop: '6px' }}>
                  Track predictions and the verifier agent will check them every 6 hours
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {verified.map((pred) => {
                  const isExpanded = expandedId === pred.id
                  const verdictColor = pred.status === 'CORRECT' ? '#22c55e' : pred.status === 'INCORRECT' ? '#ef4444' : '#eab308'
                  return (
                    <div key={pred.id} style={{ backgroundColor: '#111', border: `1px solid ${verdictColor}22`, borderRadius: '14px', overflow: 'hidden' }}>
                      {/* Header strip */}
                      <div style={{ backgroundColor: `${verdictColor}10`, borderBottom: `1px solid ${verdictColor}22`, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '18px' }}>{verdictIcon[pred.status] ?? '●'}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: verdictColor, letterSpacing: '0.04em' }}>
                            {pred.status.replace(/_/g, ' ')}
                          </div>
                          <div style={{ fontSize: '11px', color: '#555', marginTop: '1px' }}>
                            Verified {formatDate(pred.resolvedAt)} · Original confidence {Math.round(pred.confidence * 100)}%
                          </div>
                        </div>
                        {!pred.viewedAt && <span style={{ fontSize: '10px', fontWeight: 700, color: '#6366f1', backgroundColor: 'rgba(99,102,241,0.12)', borderRadius: '4px', padding: '2px 6px' }}>NEW</span>}
                        <Link href={`/article/${pred.article.id}`} style={{ fontSize: '11px', color: '#6366f1', textDecoration: 'none', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {pred.article.title}
                        </Link>
                      </div>

                      {/* Prediction text */}
                      <div style={{ padding: '14px 18px 0' }}>
                        <div style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Prediction</div>
                        <p style={{ fontSize: '14px', color: '#e0e0e0', lineHeight: '1.6', margin: 0 }}>{pred.content}</p>
                      </div>

                      {/* Analysis — collapsible */}
                      {pred.resolutionAnalysis && (
                        <div style={{ padding: '14px 18px' }}>
                          <button onClick={() => setExpandedId(isExpanded ? null : pred.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6366f1', fontSize: '12px', fontWeight: 500, padding: 0, marginBottom: isExpanded ? '12px' : 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {isExpanded ? '▾ Hide reasoning' : '▸ Show reasoning & evidence'}
                          </button>
                          {isExpanded && <AnalysisBlock text={pred.resolutionAnalysis} />}
                        </div>
                      )}

                      {/* Confidence bar */}
                      <div style={{ padding: '0 18px 14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontSize: '11px', color: '#8a8a8a' }}>Original confidence</span>
                          <span style={{ fontSize: '11px', color: verdictColor, fontWeight: 600 }}>{Math.round(pred.confidence * 100)}%</span>
                        </div>
                        <ProgressBar value={pred.confidence} max={1} color={verdictColor} height={3} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── STATS TAB ─── */}
        {!loading && tab === 'stats' && stats && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
              {[
                { label: 'Total Resolved', value: stats.total, color: '#f0f0f0' },
                { label: 'Accuracy Rate', value: `${Math.round(stats.accuracyRate * 100)}%`, color: stats.accuracyRate > 0.6 ? '#22c55e' : stats.accuracyRate > 0.4 ? '#eab308' : '#ef4444' },
                { label: 'Correct', value: stats.correct, color: '#22c55e' },
                { label: 'Incorrect', value: stats.incorrect, color: '#ef4444' },
                { label: 'Partial', value: stats.partial, color: '#eab308' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ backgroundColor: '#111', border: '1px solid #1f1f1f', borderRadius: '10px', padding: '16px' }}>
                  <div style={{ fontSize: '11px', color: '#8a8a8a', marginBottom: '6px' }}>{label}</div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color }}>{value}</div>
                </div>
              ))}
            </div>

            {stats.byConfidence.length > 0 && (
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#f0f0f0', marginBottom: '12px' }}>By Confidence Level</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {stats.byConfidence.map(b => (
                    <div key={b.bucket} style={{ backgroundColor: '#111', border: '1px solid #1f1f1f', borderRadius: '8px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <span style={{ fontSize: '13px', color: '#e0e0e0', minWidth: '80px' }}>{b.bucket}</span>
                      <div style={{ flex: 1 }}><ProgressBar value={b.rate} max={1} color={b.rate > 0.6 ? '#22c55e' : b.rate > 0.4 ? '#eab308' : '#ef4444'} height={6} /></div>
                      <span style={{ fontSize: '13px', color: '#8a8a8a', minWidth: '80px', textAlign: 'right' }}>{b.total} · {Math.round(b.rate * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {stats.byTopic.length > 0 && (
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#f0f0f0', marginBottom: '12px' }}>By Topic</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {stats.byTopic.map(t => (
                    <div key={t.topic} style={{ backgroundColor: '#111', border: '1px solid #1f1f1f', borderRadius: '8px', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '13px', color: '#e0e0e0', flex: 1 }}>{t.topic}</span>
                      <ProgressBar value={t.rate} max={1} color={t.rate > 0.6 ? '#22c55e' : t.rate > 0.4 ? '#eab308' : '#ef4444'} height={4} />
                      <span style={{ fontSize: '12px', color: '#8a8a8a', minWidth: '70px', textAlign: 'right' }}>{t.total} · {Math.round(t.rate * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {stats.total === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#555', fontSize: '14px' }}>
                No resolved predictions yet. Track predictions on article pages and mark them as they come true.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
