'use client'

import React, { useState } from 'react'
import { ExternalLink, ChevronDown, ChevronUp, Clock, Play, X, SquarePlay } from 'lucide-react'

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

interface VideoCardProps {
  video: VideoItemData
  playInApp?: boolean
  onViewed?: (id: string) => void
}

export function VideoCard({ video, playInApp = false, onViewed }: VideoCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [showTranscript, setShowTranscript] = useState(false)
  const [playing, setPlaying] = useState(false)
  const isNew = !video.viewedAt

  function markViewed() {
    if (isNew && onViewed) {
      onViewed(video.id)
      fetch(`/api/video-feed/${video.id}/viewed`, { method: 'POST' }).catch(() => {})
    }
  }

  function handleThumbnailClick(e: React.MouseEvent) {
    if (playInApp) {
      e.preventDefault()
      setPlaying(true)
      markViewed()
    } else {
      markViewed()
    }
  }

  function handleTitleClick() {
    if (!playInApp) markViewed()
  }

  const embedUrl = `https://www.youtube.com/embed/${video.videoId}?autoplay=1&rel=0&modestbranding=1`

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
      {/* Thumbnail / Player */}
      <div style={{ position: 'relative', aspectRatio: '16/9', overflow: 'hidden', flexShrink: 0, backgroundColor: '#000' }}>
        {playing ? (
          <>
            <iframe
              src={embedUrl}
              title={video.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
            />
            {/* Close player button */}
            <button
              onClick={() => setPlaying(false)}
              style={{
                position: 'absolute', top: '8px', right: '8px',
                width: '28px', height: '28px', borderRadius: '50%',
                backgroundColor: 'rgba(0,0,0,0.7)', border: 'none',
                color: '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 10,
              }}
              title="Close player"
            >
              <X size={14} />
            </button>
          </>
        ) : (
          <>
            {video.thumbnailUrl && (
              <img
                src={video.thumbnailUrl}
                alt={video.title}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            )}
            {/* Play overlay — behaviour depends on playInApp */}
            {playInApp ? (
              <button
                onClick={handleThumbnailClick}
                style={{
                  position: 'absolute', inset: 0, width: '100%', height: '100%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: 'rgba(0,0,0,0.3)', border: 'none', cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.5)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.3)')}
              >
                <div style={{
                  width: '52px', height: '52px', borderRadius: '50%',
                  backgroundColor: 'rgba(255,255,255,0.95)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
                }}>
                  <Play size={22} color="#1a1a1a" fill="#1a1a1a" style={{ marginLeft: '3px' }} />
                </div>
              </button>
            ) : (
              <a
                href={video.url}
                target="_blank"
                rel="noreferrer"
                onClick={handleThumbnailClick}
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
            )}

            {video.duration && (
              <span style={{
                position: 'absolute', bottom: '8px', right: '8px',
                backgroundColor: 'rgba(0,0,0,0.8)', color: '#fff',
                fontSize: '11px', fontWeight: 600, borderRadius: '4px', padding: '2px 6px',
                display: 'flex', alignItems: 'center', gap: '4px',
                pointerEvents: 'none',
              }}>
                <Clock size={10} /> {video.duration}
              </span>
            )}
          </>
        )}
      </div>

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
        {playInApp ? (
          <button
            onClick={() => { setPlaying(true); markViewed() }}
            style={{ fontSize: '14px', fontWeight: 600, color: '#f0f0f0', background: 'none', border: 'none', padding: 0, textAlign: 'left', lineHeight: '1.4', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#a5b4fc')}
            onMouseLeave={e => (e.currentTarget.style.color = '#f0f0f0')}
          >
            {video.title}
          </button>
        ) : (
          <a
            href={video.url}
            target="_blank"
            rel="noreferrer"
            onClick={handleTitleClick}
            style={{ fontSize: '14px', fontWeight: 600, color: '#f0f0f0', textDecoration: 'none', lineHeight: '1.4', display: 'block' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#a5b4fc')}
            onMouseLeave={e => (e.currentTarget.style.color = '#f0f0f0')}
          >
            {video.title}
          </a>
        )}

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
            {video.transcript ? 'Summary pending — run video-analyst.' : 'No summary yet — transcript unavailable.'}
          </p>
        )}

        {/* Footer */}
        <div style={{ marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            <a
              href={`/video-feed/${video.id}`}
              style={{ fontSize: '11px', color: '#6366f1', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '4px', cursor: 'pointer', padding: '2px 8px', textDecoration: 'none', fontWeight: 600 }}
            >
              Analysis →
            </a>
            {video.transcript && (
              <button
                onClick={() => setShowTranscript(!showTranscript)}
                style={{ fontSize: '11px', color: '#555', background: 'none', border: '1px solid #2a2a2a', borderRadius: '4px', cursor: 'pointer', padding: '2px 8px' }}
              >
                {showTranscript ? 'Hide' : 'Transcript'}
              </button>
            )}
          </div>
          {/* Always show "Open on YouTube" link */}
          <a
            href={video.url}
            target="_blank"
            rel="noreferrer"
            onClick={markViewed}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#555', textDecoration: 'none' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#6366f1')}
            onMouseLeave={e => (e.currentTarget.style.color = '#555')}
            title="Open on YouTube"
          >
            <SquarePlay size={13} />
            <ExternalLink size={10} />
          </a>
        </div>

        {/* Transcript accordion */}
        {showTranscript && video.transcript && (
          <div style={{ backgroundColor: '#0a0a0a', border: '1px solid #1f1f1f', borderRadius: '8px', padding: '12px', maxHeight: '200px', overflowY: 'auto' }}>
            <p style={{ fontSize: '11px', color: '#666', lineHeight: '1.6', margin: 0, whiteSpace: 'pre-wrap' }}>
              {video.transcript}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
