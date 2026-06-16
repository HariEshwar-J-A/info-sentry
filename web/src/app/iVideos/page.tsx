'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, RefreshCw, Video } from 'lucide-react'
import { TopBar } from '@/components/shell/TopBar'
import { VideoCard } from '@/components/video/VideoCard'
import { SearchInput } from '@/components/ui/SearchInput'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/LoadingState'
import { Pagination } from '@/components/ui/Pagination'
import { FormInput } from '@/components/ui/FormInput'
import { Button } from '@/components/ui/Button'

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

  // Search + pagination state
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  // Add channel form state
  const [addUrl, setAddUrl] = useState('')
  const [resolvedInfo, setResolvedInfo] = useState<{ channelId: string; channelName: string; channelUrl: string } | null>(null)
  const [resolving, setResolving] = useState(false)
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')

  // Debounce search query
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 400)
    return () => clearTimeout(t)
  }, [searchQuery])

  // Reset page when filters change
  useEffect(() => { setPage(1) }, [selectedChannel, debouncedQuery])

  const loadVideos = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '20', page: String(page) })
      if (selectedChannel) params.set('channelId', selectedChannel)
      if (debouncedQuery) params.set('q', debouncedQuery)
      const [videosRes, channelsRes] = await Promise.all([
        fetch(`/api/video-feed?${params}`),
        fetch('/api/channels'),
      ])
      if (videosRes.ok) {
        const d = (await videosRes.json()) as { videos: VideoItem[]; total: number; pages: number }
        setVideos(d.videos)
        setTotal(d.total)
        setTotalPages(d.pages)
      }
      if (channelsRes.ok) setChannels((await channelsRes.json()) as Channel[])
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [selectedChannel, debouncedQuery, page])

  useEffect(() => { void loadVideos() }, [loadVideos])

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
        subtitle={`${total} videos${debouncedQuery ? ` · searching "${debouncedQuery}"` : ''}`}
        actions={
          <Button variant="outline" size="sm" onClick={() => setShowAddChannel(!showAddChannel)}>
            <Plus size={14} /> Add Channel
          </Button>
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
                <FormInput
                  value={addUrl}
                  onChange={e => { setAddUrl(e.target.value); setResolvedInfo(null); setAddError('') }}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void handleResolve() } }}
                  placeholder="https://youtube.com/@channelname  or  youtube.com/watch?v=..."
                  status={resolvedInfo ? 'success' : 'default'}
                  style={{ flex: 1 }}
                />
                <Button type="button" variant={resolvedInfo ? 'ghost' : 'ghost'} size="sm"
                  onClick={() => void handleResolve()} disabled={resolving || !addUrl.trim()}
                  style={{ whiteSpace: 'nowrap', color: resolvedInfo ? '#22c55e' : undefined, borderColor: resolvedInfo ? 'rgba(34,197,94,0.3)' : undefined }}>
                  {resolving ? 'Resolving…' : resolvedInfo ? '✓ Resolved' : 'Resolve'}
                </Button>
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
                <Button type="submit" variant="primary" size="sm" disabled={adding || !resolvedInfo} loading={adding}>
                  {adding ? 'Adding…' : 'Add Channel'}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => { setShowAddChannel(false); setResolvedInfo(null); setAddUrl('') }}>
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Search input */}
        <div style={{ marginBottom: '16px' }}>
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search videos, transcripts, channels…"
            resultCount={debouncedQuery ? total : undefined}
          />
        </div>

        {/* Channel filter pills with integrated delete */}
        {channels.length > 0 && (
          <div className="pills-row" style={{ marginBottom: '20px', alignItems: 'center' }}>
            {/* All pill */}
            <button
              onClick={() => setSelectedChannel(null)}
              style={{
                padding: '5px 12px', borderRadius: '20px', fontFamily: 'inherit',
                border: `1px solid ${selectedChannel === null ? '#6366f1' : '#2a2a2a'}`,
                background: selectedChannel === null ? 'rgba(99,102,241,0.12)' : 'none',
                color: selectedChannel === null ? '#a5b4fc' : '#8a8a8a',
                cursor: 'pointer', fontSize: '12px', fontWeight: selectedChannel === null ? 500 : 400,
                whiteSpace: 'nowrap', transition: 'all 0.15s',
              }}
            >
              All ({total})
            </button>

            {/* Per-channel pill with × delete */}
            {channels.map(ch => {
              const isActive = selectedChannel === ch.id
              return (
                <div key={ch.id} style={{ display: 'inline-flex', alignItems: 'center', borderRadius: '20px', border: `1px solid ${isActive ? '#6366f1' : '#2a2a2a'}`, background: isActive ? 'rgba(99,102,241,0.12)' : 'none', overflow: 'hidden', transition: 'border-color 0.15s' }}>
                  <button
                    onClick={() => setSelectedChannel(isActive ? null : ch.id)}
                    style={{ padding: '5px 8px 5px 12px', background: 'none', border: 'none', cursor: 'pointer', color: isActive ? '#a5b4fc' : '#8a8a8a', fontSize: '12px', fontWeight: isActive ? 500 : 400, whiteSpace: 'nowrap', fontFamily: 'inherit' }}
                  >
                    {ch.channelName} ({ch._count.videos})
                  </button>
                  <button
                    onClick={() => void deleteChannel(ch.id)}
                    title={`Remove ${ch.channelName}`}
                    style={{ padding: '5px 8px 5px 2px', background: 'none', border: 'none', cursor: 'pointer', color: '#444', display: 'flex', alignItems: 'center', lineHeight: 1 }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#444')}
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              )
            })}

            <button
              onClick={() => void loadVideos()}
              style={{ marginLeft: 'auto', background: 'none', border: '1px solid #2a2a2a', borderRadius: '20px', color: '#555', cursor: 'pointer', padding: '5px 10px', display: 'flex', alignItems: 'center', flexShrink: 0 }}
              title="Reload"
            >
              <RefreshCw size={13} />
            </button>
          </div>
        )}

        {/* Empty state */}
        {channels.length === 0 && !loading && (
          <EmptyState
            icon={<Video size={48} />}
            title="No channels yet"
            description="Add a YouTube channel to get started"
            action={{ label: 'Add Channel', onClick: () => setShowAddChannel(true), icon: <Plus size={16} /> }}
          />
        )}

        {loading && <LoadingState label="Loading videos…" />}

        {!loading && channels.length > 0 && videos.length === 0 && (
          <EmptyState
            title={debouncedQuery ? `No results for "${debouncedQuery}"` : 'No videos yet'}
            description={debouncedQuery ? 'Try a different search term' : 'Run the YouTube scout to fetch latest videos from your channels'}
          />
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

        <div className="pagination-wrap">
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </div>
      </div>
    </div>
  )
}
