'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, ExternalLink, Clock, Calendar, Video, ChevronDown, ChevronUp, Zap } from 'lucide-react'
import { LoadingI } from '@/components/ui/LoadingState'

interface VideoDetail {
  id: string
  videoId: string
  title: string
  description: string | null
  url: string
  thumbnailUrl: string | null
  duration: string | null
  publishedAt: string | null
  transcript: string | null
  aiSummary: string | null
  viewedAt: string | null
  channel: { id: string; channelName: string; channelUrl: string; platform: string }
}

function timeAgo(iso: string | null): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days > 365) return `${Math.floor(days / 365)}y ago`
  if (days > 30) return `${Math.floor(days / 30)}mo ago`
  if (days > 0) return `${days}d ago`
  const h = Math.floor(diff / 3_600_000)
  return h > 0 ? `${h}h ago` : 'just now'
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function estimateReadTime(text: string): number {
  return Math.max(1, Math.round(text.trim().split(/\s+/).length / 200))
}

export default function VideoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [video, setVideo] = useState<VideoDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [showTranscript, setShowTranscript] = useState(false)
  const [transcriptExpanded, setTranscriptExpanded] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState('')

  async function handleGenerate() {
    if (!video) return
    setGenerating(true)
    setGenError('')
    try {
      const res = await fetch(`/api/video-feed/${video.id}/generate-transcript`, { method: 'POST' })
      const data = (await res.json()) as { transcript?: string; error?: string }
      if (!res.ok || !data.transcript) { setGenError(data.error ?? 'Failed to generate transcript'); return }
      setVideo(v => v ? { ...v, transcript: data.transcript! } : v)
      setShowTranscript(true)
    } catch { setGenError('Network error') } finally { setGenerating(false) }
  }

  useEffect(() => {
    fetch(`/api/video-feed/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setVideo(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}>
        Loading…
      </div>
    )
  }

  if (!video) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
        <div style={{ color: '#555', fontSize: '16px' }}>Video not found</div>
        <button onClick={() => router.push('/video-feed')} style={{ color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px' }}>← Back to Video Feed</button>
      </div>
    )
  }

  const readTime = video.transcript ? estimateReadTime(video.transcript) : null

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
      {/* Header bar */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'rgba(10,10,10,0.95)', backdropFilter: 'blur(8px)', borderBottom: '1px solid #1a1a1a', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button onClick={() => router.push('/video-feed')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#8a8a8a', background: 'none', border: '1px solid #1f1f1f', borderRadius: '8px', cursor: 'pointer', padding: '6px 12px', fontSize: '13px' }}>
          <ArrowLeft size={15} /> Video Feed
        </button>
        <span style={{ fontSize: '13px', color: '#555', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {video.channel.channelName} · {video.title}
        </span>
        <a href={video.url} target="_blank" rel="noreferrer"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#8a8a8a', textDecoration: 'none', border: '1px solid #1f1f1f', borderRadius: '8px', padding: '6px 12px', fontSize: '13px' }}>
          <ExternalLink size={13} /> Watch
        </a>
      </div>

      <div style={{ maxWidth: '820px', margin: '0 auto', padding: '32px 24px' }}>
        {/* Thumbnail */}
        {video.thumbnailUrl && (
          <div style={{ position: 'relative', marginBottom: '24px', borderRadius: '14px', overflow: 'hidden', aspectRatio: '16/9', backgroundColor: '#111' }}>
            <img src={video.thumbnailUrl} alt={video.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            <a href={video.url} target="_blank" rel="noreferrer"
              style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.55)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.35)')}
            >
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Video size={28} color="#1a1a1a" fill="#1a1a1a" />
              </div>
            </a>
          </div>
        )}

        {/* Title */}
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#f0f0f0', lineHeight: 1.35, margin: '0 0 16px', letterSpacing: '-0.02em' }}>
          {video.title}
        </h1>

        {/* Meta row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', flexWrap: 'wrap', fontSize: '12px', color: '#555' }}>
          <a href={video.channel.channelUrl} target="_blank" rel="noreferrer"
            style={{ color: '#6366f1', fontWeight: 600, textDecoration: 'none', fontSize: '13px' }}>
            {video.channel.channelName}
          </a>
          {video.publishedAt && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Calendar size={11} /> {formatDate(video.publishedAt)} · {timeAgo(video.publishedAt)}
            </span>
          )}
          {video.duration && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={11} /> {video.duration}
            </span>
          )}
          {readTime && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              ~{readTime} min transcript read
            </span>
          )}
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '28px' }}>
          {[
            { label: 'Channel', value: video.channel.channelName, color: '#6366f1' },
            { label: 'Transcript', value: video.transcript ? `${Math.round(video.transcript.length / 5)} words` : 'Not available', color: video.transcript ? '#22c55e' : '#555' },
            { label: 'AI Summary', value: video.aiSummary ? 'Generated' : 'Pending', color: video.aiSummary ? '#22c55e' : '#eab308' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ backgroundColor: '#111', border: '1px solid #1f1f1f', borderRadius: '10px', padding: '14px' }}>
              <div style={{ fontSize: '11px', color: '#8a8a8a', marginBottom: '6px' }}>{label}</div>
              <div style={{ fontSize: '14px', fontWeight: 600, color }}>{value}</div>
            </div>
          ))}
        </div>

        {/* AI Summary */}
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#8a8a8a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
            AI Summary
          </h2>
          {video.aiSummary ? (
            <div style={{ backgroundColor: '#111', border: '1px solid #1f1f1f', borderRadius: '12px', padding: '20px 24px' }}>
              <p style={{ fontSize: '15px', color: '#d0d0d0', lineHeight: 1.75, margin: 0, whiteSpace: 'pre-wrap' }}>
                {video.aiSummary}
              </p>
              {!video.transcript && (
                <p style={{ marginTop: '12px', fontSize: '11px', color: '#444', fontStyle: 'italic' }}>
                  Generated from metadata only — no transcript available for this video.
                </p>
              )}
            </div>
          ) : (
            <div style={{ backgroundColor: '#111', border: '1px dashed #2a2a2a', borderRadius: '12px', padding: '24px', textAlign: 'center', color: '#555', fontSize: '13px' }}>
              {video.transcript
                ? 'Summary not yet generated — run Video Analyst from Settings.'
                : 'No transcript available. Run YouTube Scout with --backfill to attempt extraction, then run Video Analyst.'}
            </div>
          )}
        </div>

        {/* Description */}
        {video.description && (
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#8a8a8a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
              Description
            </h2>
            <div style={{ backgroundColor: '#111', border: '1px solid #1f1f1f', borderRadius: '12px', padding: '18px 24px' }}>
              <p style={{ fontSize: '13px', color: '#8a8a8a', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>
                {video.description.slice(0, 800)}{video.description.length > 800 ? '…' : ''}
              </p>
            </div>
          </div>
        )}

        {/* Transcript */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#8a8a8a', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
              Transcript {video.transcript ? `(${Math.round(video.transcript.split(/\s+/).length)} words)` : ''}
            </h2>
            {video.transcript && (
              <button onClick={() => setShowTranscript(v => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                {showTranscript ? <><ChevronUp size={13} /> Hide</> : <><ChevronDown size={13} /> Show</>}
              </button>
            )}
          </div>

          {!video.transcript ? (
            <div style={{ backgroundColor: '#111', border: '1px dashed #2a2a2a', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', textAlign: 'center' }}>
              <p style={{ color: '#555', fontSize: '13px', margin: 0 }}>
                Transcript not available from YouTube. Generate one on-demand using Whisper AI.
              </p>
              {genError && <p style={{ color: '#ef4444', fontSize: '12px', margin: 0 }}>{genError}</p>}
              <button
                onClick={() => void handleGenerate()}
                disabled={generating}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                  padding: '9px 20px', borderRadius: '8px', border: 'none',
                  background: generating ? 'rgba(99,102,241,0.15)' : '#6366f1',
                  color: generating ? '#a5b4fc' : '#fff',
                  cursor: generating ? 'default' : 'pointer',
                  fontSize: '13px', fontWeight: 600, fontFamily: 'inherit',
                }}
              >
                {generating ? <LoadingI label="Generating transcript" /> : <><Zap size={14} /> Generate Transcript</>}
              </button>
            </div>
          ) : showTranscript ? (
            <div style={{ backgroundColor: '#0a0a0a', border: '1px solid #1f1f1f', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{
                padding: '18px 24px',
                maxHeight: transcriptExpanded ? 'none' : '400px',
                overflow: transcriptExpanded ? 'visible' : 'hidden',
                position: 'relative',
              }}>
                <p style={{ fontSize: '13px', color: '#666', lineHeight: 1.8, margin: 0, fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {video.transcript}
                </p>
                {!transcriptExpanded && (
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '80px', background: 'linear-gradient(transparent, #0a0a0a)' }} />
                )}
              </div>
              <div style={{ padding: '10px 24px 14px', borderTop: '1px solid #1a1a1a', display: 'flex', gap: '10px' }}>
                <button onClick={() => setTranscriptExpanded(v => !v)}
                  style={{ fontSize: '12px', color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {transcriptExpanded ? <><ChevronUp size={12} /> Show less</> : <><ChevronDown size={12} /> Show full transcript</>}
                </button>
                <button onClick={() => navigator.clipboard.writeText(video.transcript!).catch(() => {})}
                  style={{ fontSize: '12px', color: '#555', background: 'none', border: '1px solid #2a2a2a', borderRadius: '5px', cursor: 'pointer', padding: '2px 10px' }}>
                  Copy
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
