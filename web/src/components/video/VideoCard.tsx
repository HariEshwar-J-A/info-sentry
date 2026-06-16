'use client'

import React, { useState } from 'react'
import { ExternalLink, ChevronDown, ChevronUp, Clock, Play } from 'lucide-react'

interface VideoItemData {
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
  channel: { id: string; channelName: string; platform: string }
}

function timeAgo(iso: string | null): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days > 30) return `${Math.floor(days / 30)}mo ago`
  if (days > 0) return `${days}d ago`
  const h = Math.floor(diff / 3_600_000)
  if (h > 0) return `${h}h ago`
  return 'just now'
}


export function VideoCard({
  video,
  onViewed,
}: {
  video: VideoItemData
  onViewed?: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [showTranscript, setShowTranscript] = useState(false)
  const [localTranscript] = useState<string | null>(video.transcript)

  const isNew = !video.viewedAt

  function handleClick() {
    if (isNew && onViewed) {
      onViewed(video.id)
      fetch(`/api/video-feed/${video.id}/viewed`, { method: 'POST' }).catch(() => {})
    }
  }

  return (
    <div
      style={{
        backgroundColor: '#111',
        border: `1px solid ${isNew ? 'rgba(99,102,241,0.25)' : '#1f1f1f'}`,
        borderRadius: '14px',
        overflow: 'hidden',
        transition: 'border-color 0.2s',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Thumbnail */}
      {video.thumbnailUrl && (
        <div style={{ position: 'relative', aspectRatio: '16/9', overflow: 'hidden', flexShrink: 0 }}>
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
          <a
            href={video.url}
            target="_blank"
            rel="noreferrer"
            onClick={handleClick}
            style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'rgba(0,0,0,0.3)',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.5)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.3)')}
          >
            <div style={{
              width: '48px', height: '48px', borderRadius: '50%',
              backgroundColor: 'rgba(255,255,255,0.9)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Play size={20} color="#1a1a1a" fill="#1a1a1a" style={{ marginLeft: '3px' }} />
            </div>
          </a>
          {video.duration && (
            <span style={{
              position: 'absolute', bottom: '8px', right: '8px',
              backgroundColor: 'rgba(0,0,0,0.8)', color: '#fff',
              fontSize: '11px', fontWeight: 600, borderRadius: '4px', padding: '2px 6px',
              display: 'flex', alignItems: 'center', gap: '4px',
            }}>
              <Clock size={10} /> {video.duration}
            </span>
          )}
        </div>
      )}

      {/* Body */}
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
        {/* Channel + meta */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isNew && (
            <span style={{ fontSize: '9px', fontWeight: 700, color: '#6366f1', backgroundColor: 'rgba(99,102,241,0.15)', borderRadius: '4px', padding: '1px 6px', letterSpacing: '0.05em' }}>
              ● NEW
            </span>
          )}
          <span style={{ fontSize: '11px', color: '#6366f1', fontWeight: 600 }}>{video.channel.channelName}</span>
          <span style={{ fontSize: '11px', color: '#444' }}>·</span>
          <span style={{ fontSize: '11px', color: '#555' }}>{timeAgo(video.publishedAt)}</span>
        </div>

        {/* Title */}
        <a
          href={video.url}
          target="_blank"
          rel="noreferrer"
          onClick={handleClick}
          style={{ fontSize: '14px', fontWeight: 600, color: '#f0f0f0', textDecoration: 'none', lineHeight: '1.4', display: 'block' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#a5b4fc')}
          onMouseLeave={e => (e.currentTarget.style.color = '#f0f0f0')}
        >
          {video.title}
        </a>

        {/* AI Summary */}
        {video.aiSummary && (
          <div>
            <p style={{
              fontSize: '13px', color: '#a0a0a0', lineHeight: '1.6', margin: 0,
              display: expanded ? 'block' : '-webkit-box',
              WebkitLineClamp: expanded ? undefined : 3,
              WebkitBoxOrient: 'vertical' as const,
              overflow: expanded ? 'visible' : 'hidden',
            }}>
              {video.aiSummary}
            </p>
            {video.aiSummary.length > 200 && (
              <button
                onClick={() => setExpanded(!expanded)}
                style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '4px', fontSize: '11px', color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                {expanded ? <><ChevronUp size={12} /> Less</> : <><ChevronDown size={12} /> Read more</>}
              </button>
            )}
          </div>
        )}

        {!video.aiSummary && video.description && (
          <p style={{ fontSize: '13px', color: '#555', lineHeight: '1.5', margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {video.description}
          </p>
        )}

        {!video.aiSummary && !video.description && (
          <p style={{ fontSize: '12px', color: '#444', margin: 0, fontStyle: 'italic' }}>
            {localTranscript ? 'Summary pending — run video-analyst.' : 'No summary yet — transcript unavailable.'}
          </p>
        )}

        {/* Footer */}
        <div style={{ marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
            <a
              href={`/video-feed/${video.id}`}
              style={{ fontSize: '11px', color: '#6366f1', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '4px', cursor: 'pointer', padding: '2px 8px', textDecoration: 'none', fontWeight: 600 }}
            >
              Analysis →
            </a>
            {localTranscript ? (
              <button
                onClick={() => setShowTranscript(!showTranscript)}
                style={{ fontSize: '11px', color: '#555', background: 'none', border: '1px solid #2a2a2a', borderRadius: '4px', cursor: 'pointer', padding: '2px 8px' }}
              >
                {showTranscript ? 'Hide' : 'Transcript'}
              </button>
            ) : (
              <span style={{ fontSize: '11px', color: '#444', fontStyle: 'italic' }}>No transcript</span>
            )}
          </div>
          <a
            href={video.url}
            target="_blank"
            rel="noreferrer"
            onClick={handleClick}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#6366f1', textDecoration: 'none', fontWeight: 600 }}
          >
            Watch <ExternalLink size={11} />
          </a>
        </div>

        {/* Transcript accordion */}
        {showTranscript && localTranscript && (
          <div style={{ backgroundColor: '#0a0a0a', border: '1px solid #1f1f1f', borderRadius: '8px', padding: '12px', maxHeight: '200px', overflowY: 'auto' }}>
            <p style={{ fontSize: '11px', color: '#666', lineHeight: '1.6', margin: 0, whiteSpace: 'pre-wrap' }}>
              {localTranscript}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
