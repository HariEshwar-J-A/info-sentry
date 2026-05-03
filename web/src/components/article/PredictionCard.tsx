'use client'

import React, { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'

interface Prediction {
  id: string
  content: string
  confidence: number
  timeHorizon: string | null
  status: string
  createdAt: Date | string
  trackedByUser?: boolean
  dueDate?: Date | string | null
  resolutionAnalysis?: string | null
  viewedAt?: Date | string | null
}

interface PredictionCardProps {
  prediction: Prediction
}

const statusVariant: Record<string, 'positive' | 'negative' | 'neutral' | 'accent' | 'default'> = {
  PENDING: 'neutral', CORRECT: 'positive', INCORRECT: 'negative', PARTIALLY_CORRECT: 'accent', EXPIRED: 'default',
}

export function PredictionCard({ prediction: initial }: PredictionCardProps) {
  const [pred, setPred] = useState(initial)
  const [tracking, setTracking] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [showResolveMenu, setShowResolveMenu] = useState(false)
  const [analysis, setAnalysis] = useState(initial.resolutionAnalysis ?? '')
  const isNew = !initial.viewedAt

  useEffect(() => {
    if (!initial.viewedAt) {
      fetch(`/api/predictions/${initial.id}/viewed`, { method: 'POST' }).catch(() => {})
    }
  }, [initial.id, initial.viewedAt])

  const confidenceColor = pred.confidence > 0.7 ? '#22c55e' : pred.confidence > 0.5 ? '#eab308' : '#ef4444'

  async function handleTrack() {
    setTracking(true)
    try {
      const res = await fetch(`/api/predictions/${pred.id}/track`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
      })
      if (res.ok) setPred((p) => ({ ...p, trackedByUser: true }))
    } finally { setTracking(false) }
  }

  async function handleResolve(resolution: 'CORRECT' | 'INCORRECT' | 'PARTIALLY_CORRECT') {
    setResolving(true)
    setShowResolveMenu(false)
    try {
      const res = await fetch(`/api/predictions/${pred.id}/resolve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution }),
      })
      if (res.ok) {
        const { resolutionAnalysis } = (await res.json()) as { resolutionAnalysis: string }
        setPred((p) => ({ ...p, status: resolution }))
        setAnalysis(resolutionAnalysis)
      }
    } finally { setResolving(false) }
  }

  return (
    <div style={{ backgroundColor: '#111111', border: `1px solid ${isNew ? 'rgba(99,102,241,0.3)' : '#1f1f1f'}`, borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* Status + horizon + tracking */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
        {isNew && pred.status === 'PENDING' && (
          <span style={{ fontSize: '10px', fontWeight: 700, color: '#6366f1', backgroundColor: 'rgba(99,102,241,0.12)', borderRadius: '4px', padding: '1px 5px' }}>● NEW</span>
        )}
        {isNew && pred.status !== 'PENDING' && (
          <span style={{ fontSize: '10px', fontWeight: 700, color: '#eab308', backgroundColor: 'rgba(234,179,8,0.12)', borderRadius: '4px', padding: '1px 5px' }}>● RESULT</span>
        )}
        <Badge variant={statusVariant[pred.status] ?? 'default'} size="sm">
          {pred.status.replace('_', ' ')}
        </Badge>
        {pred.timeHorizon && <Badge variant="default" size="sm">{pred.timeHorizon}</Badge>}
        {pred.trackedByUser && (
          <Badge variant="accent" size="sm">📌 Tracked</Badge>
        )}
        {pred.dueDate && (
          <Badge variant="default" size="sm">
            Due: {new Date(pred.dueDate).toLocaleDateString()}
          </Badge>
        )}
      </div>

      {/* Content */}
      <p style={{ fontSize: '14px', color: '#e0e0e0', lineHeight: '1.6', margin: 0 }}>
        {pred.content}
      </p>

      {/* Confidence bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ fontSize: '11px', color: '#8a8a8a' }}>Confidence</span>
          <span style={{ fontSize: '11px', color: confidenceColor, fontWeight: 600 }}>{Math.round(pred.confidence * 100)}%</span>
        </div>
        <ProgressBar value={pred.confidence} max={1} color={confidenceColor} height={4} />
      </div>

      {/* Resolution analysis */}
      {analysis && (
        <details style={{ fontSize: '12px', color: '#8a8a8a', lineHeight: '1.5' }}>
          <summary style={{ cursor: 'pointer', color: '#6366f1', fontWeight: 500 }}>Analysis</summary>
          <p style={{ margin: '6px 0 0', paddingLeft: '8px', borderLeft: '2px solid #2a2a2a' }}>{analysis}</p>
        </details>
      )}

      {/* Action buttons */}
      {pred.status === 'PENDING' && (
        <div style={{ display: 'flex', gap: '8px', position: 'relative' }}>
          {!pred.trackedByUser && (
            <button onClick={() => void handleTrack()} disabled={tracking}
              style={{
                fontSize: '12px', padding: '5px 10px', borderRadius: '6px',
                border: '1px solid #2a2a2a', background: 'none', color: '#8a8a8a',
                cursor: tracking ? 'wait' : 'pointer', transition: 'all 0.15s',
              }}>
              {tracking ? 'Tracking…' : '📌 Track'}
            </button>
          )}
          {pred.trackedByUser && (
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowResolveMenu(!showResolveMenu)} disabled={resolving}
                style={{
                  fontSize: '12px', padding: '5px 10px', borderRadius: '6px',
                  border: '1px solid #6366f1', background: 'rgba(99,102,241,0.1)', color: '#6366f1',
                  cursor: resolving ? 'wait' : 'pointer',
                }}>
                {resolving ? 'Resolving…' : 'Resolve ▾'}
              </button>
              {showResolveMenu && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, zIndex: 50, marginTop: '4px',
                  backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px',
                  padding: '4px', minWidth: '150px', boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                }}>
                  {(['CORRECT', 'PARTIALLY_CORRECT', 'INCORRECT'] as const).map((r) => (
                    <button key={r} onClick={() => void handleResolve(r)}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px',
                        background: 'none', border: 'none', color: r === 'CORRECT' ? '#22c55e' : r === 'INCORRECT' ? '#ef4444' : '#eab308',
                        cursor: 'pointer', fontSize: '13px', borderRadius: '5px',
                      }}>
                      {r === 'CORRECT' ? '✓ Correct' : r === 'INCORRECT' ? '✗ Incorrect' : '≈ Partial'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
