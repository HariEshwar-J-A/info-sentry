'use client'

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { Bookmark, RefreshCw, Clock } from 'lucide-react'
import { ArticleCard } from './ArticleCard'
import { Badge } from '@/components/ui/Badge'
import type { ArticleWithSummary } from '@/lib/feed'

interface FeedClientProps {
  articles: ArticleWithSummary[]
  userTopics?: string[]
}

type SortMode = 'relevance' | 'date' | 'sentiment'
type SentimentFilter = 'all' | 'positive' | 'neutral' | 'negative'

export function FeedClient({ articles: initialArticles, userTopics }: FeedClientProps) {
  const searchParams = useSearchParams()
  const [articles, setArticles] = useState<ArticleWithSummary[]>(initialArticles)
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null)
  const [minRelevance, setMinRelevance] = useState(0)
  const [sort, setSort] = useState<SortMode>('date')
  const [sentimentFilter, setSentimentFilter] = useState<SentimentFilter>('all')
  const [searchInput, setSearchInput] = useState('')
  const [aiMode, setAiMode] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [showUnreadOnly, setShowUnreadOnly] = useState(false)
  const [showBookmarked, setShowBookmarked] = useState(false)
  const [bookmarkedArticles, setBookmarkedArticles] = useState<ArticleWithSummary[]>([])
  const [hours48, setHours48] = useState(false)
  const [newCount, setNewCount] = useState(0)
  const knownIdsRef = useRef(new Set(initialArticles.map((a) => a.id)))

  // Auto-fill search from ?q= URL param (used by topic seed navigation)
  useEffect(() => {
    const q = searchParams.get('q')
    if (q) setSearchInput(q)
  }, [searchParams])

  // Fetch fresh articles from API
  const refreshFeed = useCallback(async (silent = true) => {
    try {
      const url = hours48 ? '/api/feed?hours=48' : '/api/feed'
      const res = await fetch(url)
      if (!res.ok) return
      const fresh = (await res.json()) as ArticleWithSummary[]
      const genuinelyNew = fresh.filter((a) => !knownIdsRef.current.has(a.id))
      if (genuinelyNew.length > 0) {
        if (silent) {
          // Don't replace articles immediately — show banner instead
          setNewCount((c) => c + genuinelyNew.length)
        } else {
          genuinelyNew.forEach((a) => knownIdsRef.current.add(a.id))
          setArticles(fresh)
          setNewCount(0)
        }
      }
    } catch { /* ignore */ }
  }, [hours48])

  // Load full article list now (replaces stale initial data)
  const loadAll = useCallback(async () => {
    try {
      const url = hours48 ? '/api/feed?hours=48' : '/api/feed'
      const res = await fetch(url)
      if (!res.ok) return
      const fresh = (await res.json()) as ArticleWithSummary[]
      fresh.forEach((a) => knownIdsRef.current.add(a.id))
      setArticles(fresh)
      setNewCount(0)
    } catch { /* ignore */ }
  }, [hours48])

  // Refresh on window focus + every 60s
  useEffect(() => {
    const onFocus = () => { void refreshFeed(true) }
    window.addEventListener('focus', onFocus)
    const id = setInterval(() => { void refreshFeed(true) }, 60_000)
    return () => { window.removeEventListener('focus', onFocus); clearInterval(id) }
  }, [refreshFeed])

  // Reload when 48h toggle changes
  useEffect(() => { void loadAll() }, [loadAll])

  // Fetch bookmarked articles when bookmark tab is opened
  useEffect(() => {
    if (!showBookmarked) return
    fetch('/api/feed?filter=bookmarked')
      .then(r => r.json())
      .then(d => setBookmarkedArticles(d as ArticleWithSummary[]))
      .catch(() => {})
  }, [showBookmarked])

  const unreadCount = useMemo(() => articles.filter(a => !a.viewedAt).length, [articles])

  const allTopics = useMemo(() => {
    const topicCount = new Map<string, number>()
    for (const article of articles) {
      for (const topic of article.summary?.keyTopics ?? []) {
        topicCount.set(topic, (topicCount.get(topic) ?? 0) + 1)
      }
    }
    return Array.from(topicCount.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([t]) => t)
  }, [articles])

  const filteredArticles = useMemo(() => {
    let result = articles.filter((a) => {
      if (showUnreadOnly && a.viewedAt) return false
      const relevance = a.summary?.relevanceScore ?? 0
      if (relevance < minRelevance) return false
      if (selectedTopic && !a.summary?.keyTopics?.includes(selectedTopic)) return false
      if (sentimentFilter !== 'all') {
        const s = a.summary?.sentimentScore ?? 0
        if (sentimentFilter === 'positive' && s <= 0.3) return false
        if (sentimentFilter === 'negative' && s >= -0.3) return false
        if (sentimentFilter === 'neutral' && (s > 0.3 || s < -0.3)) return false
      }
      return true
    })

    if (!aiMode && searchInput.trim()) {
      const q = searchInput.toLowerCase()
      result = result.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.summary?.content?.toLowerCase().includes(q) ||
          a.summary?.keyTopics?.some((t) => t.toLowerCase().includes(q))
      )
    }

    return result
  }, [articles, minRelevance, selectedTopic, sentimentFilter, searchInput, aiMode, showUnreadOnly])

  const runSearch = useCallback(async () => {
    const q = searchInput.trim()
    if (!q) return
    setIsSearching(true)
    try {
      const endpoint = aiMode
        ? `/api/feed?aiQuery=${encodeURIComponent(q)}`
        : `/api/feed?keyword=${encodeURIComponent(q)}&sort=${sort}`
      const res = await fetch(endpoint)
      if (res.ok) {
        const data = (await res.json()) as ArticleWithSummary[]
        setArticles(data)
        data.forEach((a) => knownIdsRef.current.add(a.id))
      }
    } catch { /* ignore */ } finally {
      setIsSearching(false)
    }
  }, [searchInput, aiMode, sort])

  const handleSortChange = useCallback(async (newSort: SortMode) => {
    setSort(newSort)
    try {
      const res = await fetch(`/api/feed?sort=${newSort}`)
      if (res.ok) setArticles((await res.json()) as ArticleWithSummary[])
    } catch { /* ignore */ }
  }, [])

  return (
    <div style={{ padding: '24px 32px' }}>
      {/* New articles banner */}
      {newCount > 0 && (
        <div
          onClick={() => void loadAll()}
          style={{ marginBottom: '16px', padding: '10px 16px', backgroundColor: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <span style={{ fontSize: '13px', color: '#a5b4fc' }}>
            ✦ {newCount} new article{newCount !== 1 ? 's' : ''} available
          </span>
          <span style={{ fontSize: '12px', color: '#6366f1', fontWeight: 600 }}>Refresh →</span>
        </div>
      )}

      {/* Search + controls */}
      <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Search bar row */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '200px', display: 'flex', gap: '0', border: '1px solid #2a2a2a', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#111' }}>
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void runSearch()}
              placeholder={aiMode ? 'Ask AI to find relevant articles…' : 'Search by keyword…'}
              style={{ flex: 1, background: 'none', border: 'none', color: '#f0f0f0', fontSize: '14px', padding: '9px 14px', outline: 'none' }}
            />
            <button
              onClick={() => setAiMode(!aiMode)}
              title={aiMode ? 'Switch to keyword search' : 'Switch to AI search'}
              style={{ padding: '6px 12px', background: aiMode ? '#6366f1' : 'transparent', border: 'none', borderLeft: '1px solid #2a2a2a', cursor: 'pointer', color: aiMode ? '#fff' : '#8a8a8a', fontSize: '12px', fontWeight: 500 }}
            >
              {aiMode ? '✦ AI' : 'Kw'}
            </button>
            <button
              onClick={() => void runSearch()}
              disabled={isSearching}
              style={{ padding: '6px 14px', background: 'none', border: 'none', borderLeft: '1px solid #2a2a2a', cursor: isSearching ? 'wait' : 'pointer', color: '#8a8a8a', fontSize: '13px' }}
            >
              {isSearching ? '…' : '↵'}
            </button>
          </div>

          <select
            value={sort}
            onChange={(e) => void handleSortChange(e.target.value as SortMode)}
            style={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '13px', padding: '8px 10px', cursor: 'pointer', outline: 'none' }}
          >
            <option value="date">By Date</option>
            <option value="relevance">By Relevance</option>
            <option value="sentiment">By Sentiment</option>
          </select>

          {/* 48h toggle */}
          <button
            onClick={() => setHours48(!hours48)}
            title="Toggle: last 48 hours only"
            style={{ padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', border: `1px solid ${hours48 ? '#6366f1' : '#2a2a2a'}`, background: hours48 ? 'rgba(99,102,241,0.12)' : 'none', color: hours48 ? '#6366f1' : '#8a8a8a', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            <Clock size={13} />
            {hours48 ? '48h' : 'All time'}
          </button>

          <button
            onClick={() => { setShowUnreadOnly(!showUnreadOnly); setShowBookmarked(false) }}
            style={{ padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', border: `1px solid ${showUnreadOnly ? '#6366f1' : '#2a2a2a'}`, background: showUnreadOnly ? 'rgba(99,102,241,0.12)' : 'none', color: showUnreadOnly ? '#6366f1' : '#8a8a8a', whiteSpace: 'nowrap' }}
          >
            {showUnreadOnly ? '● Unread' : `○ Unread${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
          </button>

          <button
            onClick={() => { setShowBookmarked(!showBookmarked); setShowUnreadOnly(false) }}
            title="Bookmarked articles"
            style={{ padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', border: `1px solid ${showBookmarked ? '#6366f1' : '#2a2a2a'}`, background: showBookmarked ? 'rgba(99,102,241,0.12)' : 'none', color: showBookmarked ? '#6366f1' : '#8a8a8a', display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            <Bookmark size={13} fill={showBookmarked ? '#6366f1' : 'none'} />
            Saved
          </button>

          <button
            onClick={() => setShowFilters(!showFilters)}
            style={{ padding: '8px 12px', background: showFilters ? '#1a1a1a' : 'none', border: '1px solid #2a2a2a', borderRadius: '8px', color: showFilters ? '#f0f0f0' : '#8a8a8a', cursor: 'pointer', fontSize: '13px' }}
          >
            Filters {showFilters ? '▲' : '▼'}
          </button>

          <button
            onClick={() => void loadAll()}
            title="Reload articles"
            style={{ padding: '8px 12px', background: 'none', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#555', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center' }}
          >
            <RefreshCw size={13} />
          </button>
        </div>

        {/* Expanded filters */}
        {showFilters && (
          <div style={{ backgroundColor: '#0d0d0d', border: '1px solid #1f1f1f', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '12px', color: '#8a8a8a', minWidth: '90px' }}>Min relevance</span>
              <input type="range" min="0" max="1" step="0.1" value={minRelevance}
                onChange={(e) => setMinRelevance(parseFloat(e.target.value))}
                style={{ flex: 1, accentColor: '#6366f1', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '12px', color: '#6366f1', minWidth: '32px' }}>{Math.round(minRelevance * 100)}%</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: '#8a8a8a', minWidth: '90px' }}>Sentiment</span>
              {(['all', 'positive', 'neutral', 'negative'] as SentimentFilter[]).map((s) => (
                <Badge key={s} variant={sentimentFilter === s ? 'accent' : 'default'} size="sm" onClick={() => setSentimentFilter(s)}>
                  {s === 'positive' ? 'Positive' : s === 'negative' ? 'Negative' : s === 'neutral' ? 'Neutral' : 'All'}
                </Badge>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#8a8a8a', minWidth: '90px' }}>Topic</span>
              <Badge variant={selectedTopic === null ? 'accent' : 'default'} onClick={() => setSelectedTopic(null)} size="sm">All</Badge>
              {allTopics.map((topic) => (
                <Badge key={topic} variant={selectedTopic === topic ? 'accent' : 'default'}
                  onClick={() => setSelectedTopic(selectedTopic === topic ? null : topic)} size="sm">
                  {topic}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Topic quick-pills */}
        {!showFilters && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <Badge variant={selectedTopic === null ? 'accent' : 'default'} onClick={() => setSelectedTopic(null)} size="sm">All</Badge>
            {allTopics.slice(0, 10).map((topic) => (
              <Badge key={topic} variant={selectedTopic === topic ? 'accent' : 'default'}
                onClick={() => setSelectedTopic(selectedTopic === topic ? null : topic)} size="sm">
                {topic}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Bookmarks view */}
      {showBookmarked ? (
        <>
          <div style={{ marginBottom: '16px', fontSize: '12px', color: '#555' }}>
            {bookmarkedArticles.length} saved article{bookmarkedArticles.length !== 1 ? 's' : ''}
          </div>
          {bookmarkedArticles.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0', color: '#555' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}><Bookmark size={32} color="#333" /></div>
              <div style={{ fontSize: '14px' }}>No bookmarks yet</div>
              <div style={{ fontSize: '12px', color: '#444', marginTop: '6px' }}>Click the bookmark icon on any article to save it</div>
            </div>
          ) : (
            <div className="cards-grid">
              {bookmarkedArticles.map((article) => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  userTopics={userTopics}
                  onBookmark={(id, bm) => {
                    if (!bm) setBookmarkedArticles(prev => prev.filter(a => a.id !== id))
                  }}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {/* Count */}
          <div style={{ marginBottom: '16px', fontSize: '12px', color: '#555' }}>
            {filteredArticles.length} article{filteredArticles.length !== 1 ? 's' : ''}
            {hours48 ? ' · last 48h' : ' · all time'}
            {showUnreadOnly ? ' · unread only' : ''}
            {selectedTopic ? ` · topic: "${selectedTopic}"` : ''}
            {searchInput ? ` · "${searchInput}"` : ''}
          </div>

          {/* Article grid */}
          {filteredArticles.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0', color: '#555' }}>
              <div style={{ fontSize: '14px' }}>No articles match your filters</div>
              {searchInput && (
                <button onClick={() => setSearchInput('')} style={{ marginTop: '12px', fontSize: '12px', color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer' }}>
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <div className="cards-grid">
              {filteredArticles.map((article) => (
                <ArticleCard key={article.id} article={article} userTopics={userTopics} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
