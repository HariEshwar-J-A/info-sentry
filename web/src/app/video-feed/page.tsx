'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, RefreshCw, Video } from 'lucide-react'
import { TopBar } from '@/components/shell/TopBar'
import { VideoCard } from '@/components/video/VideoCard'

interface Channel {
  id: string
  channelName: string
  channelUrl: string
  channelId: string
  platform: string
  isActive: boolean
  lastScanned: string | null
  _count: { videos: number }
}

interface VideoItem {
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

export default function VideoFeedPage() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [videos, setVideos] = useState<VideoItem[]>([])
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAddChannel, setShowAddChannel] = useState(false)

  // Add channel form state
  const [addUrl, setAddUrl] = useState('')
  const [resolvedInfo, setResolvedInfo] = useState<{ channelId: string; channelName: string; channelUrl: string } | null>(null)
  const [resolving, setResolving] = useState(false)
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')

  const loadVideos = useCallback(async (channelId?: string) => {
    setLoading(true)
    try {
      const url = channelId ? `/api/video-feed?channelId=${channelId}` : '/api/video-feed'
      const [videosRes, channelsRes] = await Promise.all([
        fetch(url),
        fetch('/api/channels'),
      ])
      if (videosRes.ok) setVideos((await videosRes.json()) as VideoItem[])
      if (channelsRes.ok) setChannels((await channelsRes.json()) as Channel[])
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadVideos(selectedChannel ?? undefined) }, [loadVideos, selectedChannel])

  async function handleResolve() {
    if (!addUrl.trim()) return
    setResolving(true)
    setAddError('')
    setResolvedInfo(null)
    try {
      const res = await fetch('/api/channels/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: addUrl }),
      })
      const data = (await res.json()) as { channelId?: string; channelName?: string; channelUrl?: string; error?: string }
      if (!res.ok || !data.channelId) { setAddError(data.error ?? 'Could not resolve channel'); return }
      setResolvedInfo({ channelId: data.channelId, channelName: data.channelName ?? data.channelId, channelUrl: data.channelUrl ?? addUrl })
    } catch { setAddError('Network error') } finally { setResolving(false) }
  }

  async function handleAddChannel(e: React.FormEvent) {
    e.preventDefault()
    const info = resolvedInfo
    if (!addUrl || !info) return
    setAdding(true)
    setAddError('')
    try {
      const res = await fetch('/api/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelUrl: info.channelUrl, channelName: info.channelName, channelId: info.channelId }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        setAddError(data.error ?? 'Failed to add channel')
        return
      }
      setAddUrl(''); setResolvedInfo(null)
      setShowAddChannel(false)
      void loadVideos()
    } catch { setAddError('Network error') } finally { setAdding(false) }
  }

  async function deleteChannel(id: string) {
    await fetch(`/api/channels?id=${id}`, { method: 'DELETE' })
    if (selectedChannel === id) setSelectedChannel(null)
    void loadVideos()
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
      <TopBar
        title="iVideos"
        subtitle={`${videos.length} videos`}
        actions={
          <button
            onClick={() => setShowAddChannel(!showAddChannel)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '8px', border: '1px solid #2a2a2a', background: showAddChannel ? '#1a1a1a' : 'none', color: '#a5b4fc', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
          >
            <Plus size={14} /> Add Channel
          </button>
        }
      />

      <div className="page-content">
        {/* Add channel form */}
        {showAddChannel && (
          <div style={{ marginBottom: '20px', backgroundColor: '#111', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '20px' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#f0f0f0', marginBottom: '4px' }}>Add YouTube Channel</div>
            <div style={{ fontSize: '12px', color: '#555', marginBottom: '14px' }}>Paste any YouTube URL — channel page, video, or @handle — and we'll resolve it automatically.</div>
            <form onSubmit={e => void handleAddChannel(e)} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* URL + Resolve row */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  value={addUrl}
                  onChange={e => { setAddUrl(e.target.value); setResolvedInfo(null); setAddError('') }}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void handleResolve() } }}
                  placeholder="https://youtube.com/@channelname  or  youtube.com/watch?v=..."
                  style={{ flex: 1, background: '#0d0d0d', border: `1px solid ${resolvedInfo ? '#22c55e' : '#2a2a2a'}`, borderRadius: '8px', color: '#f0f0f0', fontSize: '13px', padding: '9px 14px', outline: 'none' }}
                />
                <button type="button" onClick={() => void handleResolve()} disabled={resolving || !addUrl.trim()}
                  style={{ padding: '9px 18px', borderRadius: '8px', border: 'none', background: resolvedInfo ? 'rgba(34,197,94,0.15)' : '#1a1a1a', color: resolvedInfo ? '#22c55e' : '#a0a0a0', cursor: resolving ? 'wait' : 'pointer', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {resolving ? 'Resolving…' : resolvedInfo ? '✓ Resolved' : 'Resolve'}
                </button>
              </div>

              {/* Resolved preview */}
              {resolvedInfo && (
                <div style={{ padding: '10px 14px', backgroundColor: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '8px', fontSize: '12px', color: '#a0a0a0', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <div><span style={{ color: '#555' }}>Channel:</span> <span style={{ color: '#f0f0f0', fontWeight: 600 }}>{resolvedInfo.channelName}</span></div>
                  <div><span style={{ color: '#555' }}>ID:</span> <code style={{ color: '#6366f1', fontFamily: 'monospace', fontSize: '11px' }}>{resolvedInfo.channelId}</code></div>
                  <div><span style={{ color: '#555' }}>RSS:</span> <span style={{ color: '#555', fontSize: '11px' }}>youtube.com/feeds/videos.xml?channel_id={resolvedInfo.channelId}</span></div>
                </div>
              )}

              {addError && <div style={{ fontSize: '12px', color: '#ef4444' }}>{addError}</div>}

              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" disabled={adding || !resolvedInfo}
                  style={{ padding: '7px 18px', borderRadius: '8px', border: 'none', background: resolvedInfo ? '#6366f1' : '#1a1a1a', color: resolvedInfo ? '#fff' : '#555', cursor: adding || !resolvedInfo ? 'default' : 'pointer', fontSize: '13px', fontWeight: 600 }}>
                  {adding ? 'Adding…' : 'Add Channel'}
                </button>
                <button type="button" onClick={() => { setShowAddChannel(false); setResolvedInfo(null); setAddUrl('') }}
                  style={{ padding: '7px 14px', borderRadius: '8px', border: '1px solid #2a2a2a', background: 'none', color: '#8a8a8a', cursor: 'pointer', fontSize: '13px' }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Channel filter tabs */}
        {channels.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={() => setSelectedChannel(null)}
              style={{ padding: '5px 14px', borderRadius: '6px', border: `1px solid ${selectedChannel === null ? '#6366f1' : '#2a2a2a'}`, background: selectedChannel === null ? 'rgba(99,102,241,0.12)' : 'none', color: selectedChannel === null ? '#6366f1' : '#8a8a8a', cursor: 'pointer', fontSize: '12px', fontWeight: 500 }}>
              All ({videos.length})
            </button>
            {channels.map(ch => (
              <div key={ch.id} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button
                  onClick={() => setSelectedChannel(ch.id === selectedChannel ? null : ch.id)}
                  style={{ padding: '5px 12px', borderRadius: '6px', border: `1px solid ${selectedChannel === ch.id ? '#6366f1' : '#2a2a2a'}`, background: selectedChannel === ch.id ? 'rgba(99,102,241,0.12)' : 'none', color: selectedChannel === ch.id ? '#6366f1' : '#8a8a8a', cursor: 'pointer', fontSize: '12px', fontWeight: 500 }}>
                  {ch.channelName} ({ch._count.videos})
                </button>
                <button
                  onClick={() => void deleteChannel(ch.id)}
                  title="Remove channel"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: '3px', display: 'flex', alignItems: 'center', borderRadius: '4px' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#555')}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            <button
              onClick={() => void loadVideos(selectedChannel ?? undefined)}
              style={{ marginLeft: 'auto', background: 'none', border: '1px solid #2a2a2a', borderRadius: '6px', color: '#555', cursor: 'pointer', padding: '5px 8px', display: 'flex', alignItems: 'center' }}
              title="Reload"
            >
              <RefreshCw size={13} />
            </button>
          </div>
        )}

        {/* Empty state */}
        {channels.length === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#555' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
              <Video size={48} color="#333" />
            </div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: '#e0e0e0', marginBottom: '8px' }}>No channels yet</div>
            <div style={{ fontSize: '13px', marginBottom: '20px' }}>Add a YouTube channel to get started</div>
            <button
              onClick={() => setShowAddChannel(true)}
              style={{ padding: '10px 24px', borderRadius: '10px', border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              <Plus size={16} /> Add Channel
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#555', fontSize: '14px' }}>
            Loading videos…
          </div>
        )}

        {/* No videos */}
        {!loading && channels.length > 0 && videos.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#555' }}>
            <div style={{ fontSize: '14px', marginBottom: '8px' }}>No videos yet</div>
            <div style={{ fontSize: '12px', color: '#444' }}>Run the YouTube scout to fetch latest videos from your channels</div>
          </div>
        )}

        {/* Video grid */}
        {!loading && videos.length > 0 && (
          <div className="cards-grid">
            {videos.map(video => (
              <VideoCard
                key={video.id}
                video={video}
                onViewed={(id) => setVideos(prev => prev.map(v => v.id === id ? { ...v, viewedAt: new Date().toISOString() } : v))}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
