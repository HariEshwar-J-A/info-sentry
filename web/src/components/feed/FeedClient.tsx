'use client'

import React, { useState, useMemo } from 'react'
import { ArticleCard } from './ArticleCard'
import { Badge } from '@/components/ui/Badge'
import type { ArticleWithSummary } from '@/lib/feed'

interface FeedClientProps {
  articles: ArticleWithSummary[]
}

export function FeedClient({ articles }: FeedClientProps) {
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null)
  const [minRelevance, setMinRelevance] = useState(0)

  // Gather all topics from articles
  const allTopics = useMemo(() => {
    const topicCount = new Map<string, number>()
    for (const article of articles) {
      for (const topic of article.summary?.keyTopics ?? []) {
        topicCount.set(topic, (topicCount.get(topic) ?? 0) + 1)
      }
    }
    return Array.from(topicCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([topic]) => topic)
  }, [articles])

  // Filter articles client-side
  const filteredArticles = useMemo(() => {
    return articles.filter((a) => {
      const relevance = a.summary?.relevanceScore ?? 0
      if (relevance < minRelevance) return false
      if (selectedTopic && !a.summary?.keyTopics?.includes(selectedTopic)) return false
      return true
    })
  }, [articles, selectedTopic, minRelevance])

  return (
    <div style={{ padding: '24px 32px' }}>
      {/* Filter bar */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          marginBottom: '24px',
          flexWrap: 'wrap',
        }}
      >
        {/* Relevance threshold */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: '#8a8a8a', whiteSpace: 'nowrap' }}>
            Min relevance
          </span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={minRelevance}
            onChange={(e) => setMinRelevance(parseFloat(e.target.value))}
            style={{
              width: '80px',
              accentColor: '#6366f1',
              cursor: 'pointer',
            }}
          />
          <span style={{ fontSize: '12px', color: '#6366f1', minWidth: '28px' }}>
            {Math.round(minRelevance * 100)}%
          </span>
        </div>

        <div style={{ width: '1px', height: '20px', backgroundColor: '#1f1f1f' }} />

        {/* Topic pills */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <Badge
            variant={selectedTopic === null ? 'accent' : 'default'}
            onClick={() => setSelectedTopic(null)}
            size="sm"
          >
            All
          </Badge>
          {allTopics.map((topic) => (
            <Badge
              key={topic}
              variant={selectedTopic === topic ? 'accent' : 'default'}
              onClick={() => setSelectedTopic(selectedTopic === topic ? null : topic)}
              size="sm"
            >
              {topic}
            </Badge>
          ))}
        </div>
      </div>

      {/* Count */}
      <div style={{ marginBottom: '16px', fontSize: '12px', color: '#555' }}>
        {filteredArticles.length} article{filteredArticles.length !== 1 ? 's' : ''}
        {selectedTopic ? ` in "${selectedTopic}"` : ''}
      </div>

      {/* Article grid */}
      {filteredArticles.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '80px 0',
            color: '#555',
          }}
        >
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>◎</div>
          <div style={{ fontSize: '14px' }}>No articles match your filters</div>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: '16px',
          }}
        >
          {filteredArticles.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      )}
    </div>
  )
}
