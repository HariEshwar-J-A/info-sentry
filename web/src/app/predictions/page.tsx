'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
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
  article: { id: string; title: string; url: string }
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

export default function PredictionsPage() {
  const [tab, setTab] = useState<'tracked' | 'stats'>('tracked')
  const [tracked, setTracked] = useState<TrackedPrediction[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [resolving, setResolving] = useState<string | null>(null)
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    if (tab === 'tracked') {
      fetch('/api/predictions/tracked').then((r) => r.json()).then((d) => { setTracked(d as TrackedPrediction[]); setLoading(false) }).catch(() => setLoading(false))
    } else {
      fetch('/api/predictions/stats').then((r) => r.json()).then((d) => { setStats(d as Stats); setLoading(false) }).catch(() => setLoading(false))
    }
  }, [tab])

  async function resolve(id: string, resolution: 'CORRECT' | 'INCORRECT' | 'PARTIALLY_CORRECT') {
    setResolving(id)
    setOpenMenu(null)
    try {
      const res = await fetch(`/api/predictions/${id}/resolve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resolution }),
      })
      if (res.ok) {
        const { resolutionAnalysis } = (await res.json()) as { resolutionAnalysis: string }
        setTracked((prev) => prev.map((p) => p.id === id ? { ...p, status: resolution, resolutionAnalysis } : p))
      }
    } finally { setResolving(null) }
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
      <TopBar title="Predictions" subtitle="Track and resolve AI predictions" />

      <div style={{ padding: '24px 32px' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '28px', backgroundColor: '#111', border: '1px solid #1f1f1f', borderRadius: '10px', padding: '4px', width: 'fit-content' }}>
          {(['tracked', 'stats'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              style={{
                padding: '7px 18px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 500,
                backgroundColor: tab === t ? '#1f1f1f' : 'transparent',
                color: tab === t ? '#f0f0f0' : '#8a8a8a', transition: 'all 0.15s',
              }}>
              {t === 'tracked' ? '📌 Tracked' : '📊 Accuracy'}
            </button>
          ))}
        </div>

        {loading && <div style={{ color: '#555', fontSize: '14px' }}>Loading…</div>}

        {/* Tracked tab */}
        {!loading && tab === 'tracked' && (
          <div>
            {tracked.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px 0', color: '#555' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>🎯</div>
                <div style={{ fontSize: '14px' }}>No tracked predictions yet</div>
                <div style={{ fontSize: '12px', color: '#444', marginTop: '6px' }}>Track predictions from article pages</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {tracked.map((pred) => (
                  <div key={pred.id} style={{ backgroundColor: '#111', border: `1px solid ${statusColor[pred.status] ?? '#1f1f1f'}22`, borderRadius: '12px', padding: '20px' }}>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <Badge variant={statusVariant[pred.status] ?? 'default'} size="sm">{pred.status.replace('_', ' ')}</Badge>
                      {pred.timeHorizon && <Badge variant="default" size="sm">{pred.timeHorizon}</Badge>}
                      {pred.dueDate && (
                        <Badge variant="default" size="sm">Due {new Date(pred.dueDate).toLocaleDateString()}</Badge>
                      )}
                      <Link href={`/article/${pred.article.id}`} style={{ marginLeft: 'auto', fontSize: '11px', color: '#6366f1', textDecoration: 'none' }}>
                        {pred.article.title.slice(0, 40)}…
                      </Link>
                    </div>

                    <p style={{ fontSize: '14px', color: '#e0e0e0', lineHeight: '1.6', margin: '0 0 12px' }}>{pred.content}</p>

                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '11px', color: '#8a8a8a' }}>Confidence</span>
                        <span style={{ fontSize: '11px', color: pred.confidence > 0.7 ? '#22c55e' : pred.confidence > 0.5 ? '#eab308' : '#ef4444', fontWeight: 600 }}>
                          {Math.round(pred.confidence * 100)}%
                        </span>
                      </div>
                      <ProgressBar value={pred.confidence} max={1} color={pred.confidence > 0.7 ? '#22c55e' : pred.confidence > 0.5 ? '#eab308' : '#ef4444'} height={4} />
                    </div>

                    {pred.resolutionAnalysis && (
                      <div style={{ backgroundColor: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '8px', padding: '10px', fontSize: '12px', color: '#a0a0a0', lineHeight: '1.5', marginBottom: '10px' }}>
                        {pred.resolutionAnalysis}
                      </div>
                    )}

                    {pred.status === 'PENDING' && (
                      <div style={{ position: 'relative', display: 'inline-block' }}>
                        <button onClick={() => setOpenMenu(openMenu === pred.id ? null : pred.id)}
                          disabled={resolving === pred.id}
                          style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '6px', border: '1px solid #6366f1', background: 'rgba(99,102,241,0.1)', color: '#6366f1', cursor: 'pointer' }}>
                          {resolving === pred.id ? 'Resolving…' : 'Resolve ▾'}
                        </button>
                        {openMenu === pred.id && (
                          <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 50, marginTop: '4px', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '4px', minWidth: '150px', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>
                            {(['CORRECT', 'PARTIALLY_CORRECT', 'INCORRECT'] as const).map((r) => (
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

        {/* Stats tab */}
        {!loading && tab === 'stats' && stats && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {/* Overview */}
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

            {/* By confidence bucket */}
            {stats.byConfidence.length > 0 && (
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#f0f0f0', marginBottom: '12px' }}>Accuracy by Confidence Level</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {stats.byConfidence.map((b) => (
                    <div key={b.bucket} style={{ backgroundColor: '#111', border: '1px solid #1f1f1f', borderRadius: '8px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <span style={{ fontSize: '13px', color: '#e0e0e0', minWidth: '80px' }}>{b.bucket}</span>
                      <div style={{ flex: 1 }}><ProgressBar value={b.rate} max={1} color={b.rate > 0.6 ? '#22c55e' : b.rate > 0.4 ? '#eab308' : '#ef4444'} height={6} /></div>
                      <span style={{ fontSize: '13px', color: '#8a8a8a', minWidth: '60px', textAlign: 'right' }}>{b.total} preds · {Math.round(b.rate * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* By topic */}
            {stats.byTopic.length > 0 && (
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#f0f0f0', marginBottom: '12px' }}>Accuracy by Topic</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {stats.byTopic.map((t) => (
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
