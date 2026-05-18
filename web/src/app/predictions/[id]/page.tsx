'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { TopBar } from '@/components/shell/TopBar'
import {
  ArrowLeft, CheckCircle, XCircle, AlertCircle, Clock, ExternalLink,
  TrendingUp, TrendingDown, Minus, Trash2,
} from 'lucide-react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'

interface Evidence {
  id: string
  impact: number
  summary: string
  title: string | null
  url: string | null
  articleId: string | null
  createdAt: string
}

interface ConfidenceLog {
  id: string
  confidence: number
  source: string
  note: string | null
  createdAt: string
}

interface PredictionDetail {
  id: string
  title: string | null
  content: string
  category: string | null
  isUserDefined: boolean
  confidence: number
  aiConfidence: number | null
  aiAnalysis: string | null
  lastAnalyzedAt: string | null
  status: string
  timeHorizon: string | null
  dueDate: string | null
  userContext: string | null
  resolutionAnalysis: string | null
  resolvedAt: string | null
  createdAt: string
  article: { id: string; title: string; url: string } | null
  evidence: Evidence[]
  confidenceLogs: ConfidenceLog[]
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: '#6366f1',
  CORRECT: '#22c55e',
  INCORRECT: '#ef4444',
  PARTIALLY_CORRECT: '#eab308',
  EXPIRED: '#555',
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  PENDING: <Clock size={14} />,
  CORRECT: <CheckCircle size={14} />,
  INCORRECT: <XCircle size={14} />,
  PARTIALLY_CORRECT: <AlertCircle size={14} />,
  EXPIRED: <Clock size={14} />,
}

function impactLabel(impact: number): { label: string; color: string; Icon: React.ElementType } {
  if (impact >= 0.3) return { label: 'Supports', color: '#22c55e', Icon: TrendingUp }
  if (impact <= -0.3) return { label: 'Contradicts', color: '#ef4444', Icon: TrendingDown }
  return { label: 'Neutral', color: '#eab308', Icon: Minus }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function daysUntil(iso: string | null): string | null {
  if (!iso) return null
  const diff = new Date(iso).getTime() - Date.now()
  const days = Math.ceil(diff / 86_400_000)
  if (days < 0) return `${Math.abs(days)}d overdue`
  if (days === 0) return 'Due today'
  return `${days}d remaining`
}

export default function PredictionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [pred, setPred] = useState<PredictionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetch(`/api/predictions/${id}`)
      .then(r => r.json())
      .then(d => setPred(d as PredictionDetail))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  async function handleDelete() {
    if (!confirm('Delete this prediction? This cannot be undone.')) return
    setDeleting(true)
    await fetch(`/api/predictions/${id}`, { method: 'DELETE' })
    router.push('/predictions')
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
        <TopBar title="Prediction" />
        <div style={{ textAlign: 'center', padding: '80px 0', color: '#555', fontSize: '14px' }}>Loading…</div>
      </div>
    )
  }

  if (!pred) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
        <TopBar title="Prediction" />
        <div style={{ textAlign: 'center', padding: '80px 0', color: '#555' }}>Prediction not found.</div>
      </div>
    )
  }

  const statusColor = STATUS_COLOR[pred.status] ?? '#555'
  const chartData = pred.confidenceLogs.map(l => ({
    date: new Date(l.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    confidence: Math.round(l.confidence * 100),
    source: l.source,
  }))

  const dayStr = daysUntil(pred.dueDate)

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
      <TopBar
        title={pred.title ?? pred.content.slice(0, 55)}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {pred.isUserDefined && (
              <button
                onClick={() => void handleDelete()}
                disabled={deleting}
                style={{ background: 'none', border: '1px solid #2a2a2a', borderRadius: '6px', color: '#555', cursor: 'pointer', padding: '5px 8px', display: 'flex', alignItems: 'center' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                onMouseLeave={e => (e.currentTarget.style.color = '#555')}
                title="Delete prediction"
              >
                <Trash2 size={13} />
              </button>
            )}
            <Link href="/predictions" style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: '#555', textDecoration: 'none' }}>
              <ArrowLeft size={14} /> Back
            </Link>
          </div>
        }
      />

      <div className="page-content" style={{ maxWidth: '780px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Header card */}
        <div style={{ backgroundColor: '#111', border: `1px solid ${statusColor}33`, borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Status badge */}
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: statusColor, backgroundColor: `${statusColor}18`, borderRadius: '6px', padding: '3px 8px' }}>
              {STATUS_ICON[pred.status]} {pred.status.replace('_', ' ')}
            </span>
            {/* Source badge */}
            <span style={{ fontSize: '10px', fontWeight: 600, color: pred.isUserDefined ? '#a5b4fc' : '#555', backgroundColor: pred.isUserDefined ? 'rgba(99,102,241,0.1)' : '#1a1a1a', borderRadius: '4px', padding: '2px 7px' }}>
              {pred.isUserDefined ? 'Your prediction' : 'AI-generated'}
            </span>
            {/* Category */}
            {pred.category && (
              <span style={{ fontSize: '10px', color: '#8a8a8a', backgroundColor: '#1a1a1a', borderRadius: '4px', padding: '2px 7px' }}>
                {pred.category}
              </span>
            )}
            {/* Due date */}
            {dayStr && (
              <span style={{ fontSize: '10px', color: pred.status === 'PENDING' ? '#eab308' : '#555', backgroundColor: '#1a1a1a', borderRadius: '4px', padding: '2px 7px' }}>
                {dayStr}
              </span>
            )}
            {pred.timeHorizon && (
              <span style={{ fontSize: '10px', color: '#555', marginLeft: 'auto' }}>{pred.timeHorizon}</span>
            )}
          </div>

          {/* Full prediction text */}
          <p style={{ fontSize: '15px', color: '#f0f0f0', lineHeight: '1.6', margin: 0, fontWeight: 500 }}>
            {pred.content}
          </p>

          {/* Confidence row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '11px', color: '#555', marginBottom: '4px' }}>
                Your confidence: <strong style={{ color: '#f0f0f0' }}>{Math.round(pred.confidence * 100)}%</strong>
                {pred.aiConfidence !== null && (
                  <> · AI: <strong style={{ color: pred.aiConfidence >= 0.6 ? '#22c55e' : pred.aiConfidence >= 0.4 ? '#eab308' : '#ef4444' }}>{Math.round((pred.aiConfidence ?? 0) * 100)}%</strong></>
                )}
              </div>
              <div style={{ height: '5px', borderRadius: '3px', backgroundColor: '#1a1a1a', overflow: 'hidden', position: 'relative' }}>
                <div style={{ position: 'absolute', height: '100%', width: `${pred.confidence * 100}%`, background: '#6366f1', borderRadius: '3px', opacity: 0.4 }} />
                {pred.aiConfidence !== null && (
                  <div style={{ position: 'absolute', height: '100%', width: `${(pred.aiConfidence ?? 0) * 100}%`, background: pred.aiConfidence >= 0.6 ? '#22c55e' : pred.aiConfidence >= 0.4 ? '#eab308' : '#ef4444', borderRadius: '3px' }} />
                )}
              </div>
            </div>
          </div>

          {/* Source article link */}
          {pred.article && (
            <a href={pred.article.url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#6366f1', textDecoration: 'none' }}>
              <ExternalLink size={11} /> Source: {pred.article.title.slice(0, 80)}
            </a>
          )}

          {/* User context */}
          {pred.userContext && (
            <div style={{ borderTop: '1px solid #1a1a1a', paddingTop: '10px', fontSize: '13px', color: '#8a8a8a', lineHeight: '1.5' }}>
              <span style={{ fontSize: '11px', color: '#555', fontWeight: 600 }}>Your reasoning: </span>{pred.userContext}
            </div>
          )}
        </div>

        {/* Confidence timeline chart */}
        {chartData.length > 0 && (
          <div style={{ backgroundColor: '#111', border: '1px solid #1f1f1f', borderRadius: '14px', padding: '20px' }}>
            <div style={{ fontSize: '12px', color: '#8a8a8a', marginBottom: '14px', fontWeight: 600 }}>Confidence over time</div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid stroke="#1a1a1a" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fill: '#555', fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fill: '#555', fontSize: 11 }} tickFormatter={v => `${v}%`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px', fontSize: '12px', color: '#f0f0f0' }}
                  formatter={(v: unknown) => [`${v as number}%`, 'Confidence']}
                />
                <ReferenceLine y={50} stroke="#2a2a2a" strokeDasharray="4 2" />
                <Line
                  type="monotone"
                  dataKey="confidence"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={{ fill: '#6366f1', r: 4, strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: '#a5b4fc' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Evidence feed */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#8a8a8a' }}>
            Evidence ({pred.evidence.length})
            {pred.lastAnalyzedAt && (
              <span style={{ fontSize: '11px', color: '#444', fontWeight: 400, marginLeft: '8px' }}>
                · last analyzed {formatDate(pred.lastAnalyzedAt)}
              </span>
            )}
          </div>

          {pred.evidence.length === 0 ? (
            <div style={{ backgroundColor: '#111', border: '1px solid #1f1f1f', borderRadius: '12px', padding: '24px', textAlign: 'center', color: '#444' }}>
              <div style={{ fontSize: '13px', marginBottom: '6px' }}>No evidence yet</div>
              <div style={{ fontSize: '12px' }}>Evidence links will appear here after the Prediction Verifier runs and finds relevant news</div>
            </div>
          ) : (
            pred.evidence.map(ev => {
              const { label, color, Icon } = impactLabel(ev.impact)
              return (
                <div key={ev.id} style={{ backgroundColor: '#111', border: `1px solid ${color}22`, borderRadius: '12px', padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ flexShrink: 0, marginTop: '2px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color, backgroundColor: `${color}18`, borderRadius: '5px', padding: '2px 7px', whiteSpace: 'nowrap' }}>
                        <Icon size={11} /> {label}
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {ev.title && (
                        ev.url ? (
                          <a href={ev.url} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#6366f1', textDecoration: 'none', display: 'block', marginBottom: '4px' }}>
                            {ev.title} <ExternalLink size={10} style={{ display: 'inline', verticalAlign: 'middle' }} />
                          </a>
                        ) : (
                          <div style={{ fontSize: '12px', color: '#8a8a8a', marginBottom: '4px' }}>{ev.title}</div>
                        )
                      )}
                      <p style={{ fontSize: '13px', color: '#c0c0c0', margin: 0, lineHeight: '1.5' }}>{ev.summary}</p>
                    </div>
                    <div style={{ flexShrink: 0 }}>
                      {/* Impact bar */}
                      <div style={{ width: '60px', height: '4px', backgroundColor: '#1a1a1a', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${Math.abs(ev.impact) * 100}%`,
                          background: color,
                          borderRadius: '2px',
                          marginLeft: ev.impact < 0 ? `${(1 - Math.abs(ev.impact)) * 100}%` : 0,
                        }} />
                      </div>
                      <div style={{ fontSize: '10px', color: '#444', textAlign: 'center', marginTop: '3px' }}>
                        {ev.impact > 0 ? '+' : ''}{ev.impact.toFixed(1)}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: '10px', color: '#333', marginTop: '8px', textAlign: 'right' }}>
                    {formatDate(ev.createdAt)}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* AI Analysis */}
        {pred.aiAnalysis && (
          <div style={{ backgroundColor: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', padding: '16px' }}>
            <div style={{ fontSize: '11px', color: '#6366f1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
              AI Analysis{pred.lastAnalyzedAt ? ` · ${formatDate(pred.lastAnalyzedAt)}` : ''}
            </div>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => <p style={{ fontSize: '13px', color: '#c0c0c0', lineHeight: '1.6', margin: '0 0 8px 0' }}>{children}</p>,
                strong: ({ children }) => <strong style={{ color: '#f0f0f0' }}>{children}</strong>,
                ul: ({ children }) => <ul style={{ paddingLeft: '18px', margin: '6px 0', color: '#c0c0c0', fontSize: '13px' }}>{children}</ul>,
                li: ({ children }) => <li style={{ marginBottom: '4px', lineHeight: '1.5' }}>{children}</li>,
              }}
            >
              {pred.aiAnalysis}
            </ReactMarkdown>
          </div>
        )}

        {/* Resolution */}
        {pred.status !== 'PENDING' && pred.resolutionAnalysis && (
          <div style={{ backgroundColor: '#111', border: `1px solid ${statusColor}33`, borderRadius: '12px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{ color: statusColor }}>{STATUS_ICON[pred.status]}</span>
              <span style={{ color: statusColor, fontWeight: 700, fontSize: '13px' }}>
                {pred.status.replace('_', ' ')}
              </span>
              {pred.resolvedAt && (
                <span style={{ fontSize: '11px', color: '#555' }}>— resolved {formatDate(pred.resolvedAt)}</span>
              )}
            </div>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => <p style={{ fontSize: '13px', color: '#c0c0c0', lineHeight: '1.6', margin: '0 0 6px 0' }}>{children}</p>,
                strong: ({ children }) => <strong style={{ color: '#f0f0f0' }}>{children}</strong>,
              }}
            >
              {pred.resolutionAnalysis}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
}
