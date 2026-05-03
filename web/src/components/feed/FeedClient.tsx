'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { ArticleCard } from './ArticleCard'
import { Badge } from '@/components/ui/Badge'
import type { ArticleWithSummary } from '@/lib/feed'

interface FeedClientProps {
  articles: ArticleWithSummary[]
}

type SortMode = 'relevance' | 'date' | 'sentiment'
type SentimentFilter = 'all' | 'positive' | 'neutral' | 'negative'

export function FeedClient({ articles: initialArticles }: FeedClientProps) {
  const [articles, setArticles] = useState<ArticleWithSummary[]>(initialArticles)
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null)
  const [minRelevance, setMinRelevance] = useState(0)
  const [sort, setSort] = useState<SortMode>('relevance')
  const [sentimentFilter, setSentimentFilter] = useState<SentimentFilter>('all')
  const [searchInput, setSearchInput] = useState('')
  const [aiMode, setAiMode] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [showUnreadOnly, setShowUnreadOnly] = useState(false)

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
  }, [articles, minRelevance, selectedTopic, sentimentFilter, searchInput, aiMode])

  const runSearch = useCallback(async () => {
    const q = searchInput.trim()
    if (!q) return
    setIsSearching(true)
    try {
      const endpoint = aiMode ? `/api/feed?aiQuery=${encodeURIComponent(q)}` : `/api/feed?keyword=${encodeURIComponent(q)}&sort=${sort}`
      const res = await fetch(endpoint)
      if (res.ok) {
        const data = (await res.json()) as ArticleWithSummary[]
        setArticles(data)
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
      {/* Search + controls */}
      <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Search bar row */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ flex: 1, display: 'flex', gap: '0', border: '1px solid #2a2a2a', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#111' }}>
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runSearch()}
              placeholder={aiMode ? 'Ask AI to find relevant articles…' : 'Search by keyword…'}
              style={{
                flex: 1, background: 'none', border: 'none', color: '#f0f0f0', fontSize: '14px',
                padding: '9px 14px', outline: 'none',
              }}
            />
            <button
              onClick={() => setAiMode(!aiMode)}
              title={aiMode ? 'Switch to keyword search' : 'Switch to AI search'}
              style={{
                padding: '6px 12px', background: aiMode ? '#6366f1' : 'transparent',
                border: 'none', borderLeft: '1px solid #2a2a2a', cursor: 'pointer',
                color: aiMode ? '#fff' : '#8a8a8a', fontSize: '12px', fontWeight: 500,
                transition: 'all 0.15s',
              }}
            >
              {aiMode ? '✦ AI' : 'Kw'}
            </button>
            <button
              onClick={runSearch}
              disabled={isSearching}
              style={{
                padding: '6px 14px', background: 'none', border: 'none',
                borderLeft: '1px solid #2a2a2a', cursor: isSearching ? 'wait' : 'pointer',
                color: '#8a8a8a', fontSize: '13px',
              }}
            >
              {isSearching ? '…' : '↵'}
            </button>
          </div>

          {/* Sort */}
          <select
            value={sort}
            onChange={(e) => handleSortChange(e.target.value as SortMode)}
            style={{
              background: '#111', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0',
              fontSize: '13px', padding: '8px 10px', cursor: 'pointer', outline: 'none',
            }}
          >
            <option value="relevance">By Relevance</option>
            <option value="date">By Date</option>
            <option value="sentiment">By Sentiment</option>
          </select>

          <button
            onClick={() => setShowUnreadOnly(!showUnreadOnly)}
            title={`${unreadCount} unread article${unreadCount !== 1 ? 's' : ''}`}
            style={{
              padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', transition: 'all 0.15s',
              border: `1px solid ${showUnreadOnly ? '#6366f1' : '#2a2a2a'}`,
              background: showUnreadOnly ? 'rgba(99,102,241,0.12)' : 'none',
              color: showUnreadOnly ? '#6366f1' : '#8a8a8a',
              display: 'flex', alignItems: 'center', gap: '5px',
            }}
          >
            {showUnreadOnly ? '● Unread' : `○ Unread${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            style={{
              padding: '8px 12px', background: showFilters ? '#1a1a1a' : 'none',
              border: '1px solid #2a2a2a', borderRadius: '8px', color: showFilters ? '#f0f0f0' : '#8a8a8a',
              cursor: 'pointer', fontSize: '13px', transition: 'all 0.15s',
            }}
          >
            Filters {showFilters ? '▲' : '▼'}
          </button>
        </div>

        {/* Expanded filters */}
        {showFilters && (
          <div style={{ backgroundColor: '#0d0d0d', border: '1px solid #1f1f1f', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Relevance slider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '12px', color: '#8a8a8a', minWidth: '90px' }}>Min relevance</span>
              <input type="range" min="0" max="1" step="0.1" value={minRelevance}
                onChange={(e) => setMinRelevance(parseFloat(e.target.value))}
                style={{ flex: 1, accentColor: '#6366f1', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '12px', color: '#6366f1', minWidth: '32px' }}>{Math.round(minRelevance * 100)}%</span>
            </div>

            {/* Sentiment filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: '#8a8a8a', minWidth: '90px' }}>Sentiment</span>
              {(['all', 'positive', 'neutral', 'negative'] as SentimentFilter[]).map((s) => (
                <Badge key={s} variant={sentimentFilter === s ? 'accent' : 'default'} size="sm" onClick={() => setSentimentFilter(s)}>
                  {s === 'positive' ? '🟢 Positive' : s === 'negative' ? '🔴 Negative' : s === 'neutral' ? '🟡 Neutral' : 'All'}
                </Badge>
              ))}
            </div>

            {/* Topic pills */}
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

        {/* Topic quick-pills (always visible) */}
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

      {/* Count */}
      <div style={{ marginBottom: '16px', fontSize: '12px', color: '#555' }}>
        {filteredArticles.length} article{filteredArticles.length !== 1 ? 's' : ''}
        {showUnreadOnly ? ' · unread only' : ''}
        {selectedTopic ? ` in "${selectedTopic}"` : ''}
        {aiMode && searchInput ? ` · AI search: "${searchInput}"` : ''}
      </div>

      {/* Article grid */}
      {filteredArticles.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 0', color: '#555' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>◎</div>
          <div style={{ fontSize: '14px' }}>No articles match your filters</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
          {filteredArticles.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      )}
    </div>
  )
}
