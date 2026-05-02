'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { SentimentBar } from './SentimentBar'
import type { ArticleWithSummary } from '@/lib/feed'

interface ArticleCardProps {
  article: ArticleWithSummary
  onFeedback?: (articleId: string, type: 'like' | 'dislike') => void
}

function ThumbUpIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3z" />
      <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
    </svg>
  )
}

function ThumbDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3z" />
      <path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
    </svg>
  )
}

function ExternalLinkIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  )
}

function formatTimeAgo(date: Date): string {
  const now = Date.now()
  const diff = now - new Date(date).getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor(diff / (1000 * 60))

  if (hours > 24) return `${Math.floor(hours / 24)}d ago`
  if (hours > 0) return `${hours}h ago`
  return `${minutes}m ago`
}

export function ArticleCard({ article, onFeedback }: ArticleCardProps) {
  const [feedbackGiven, setFeedbackGiven] = useState<'like' | 'dislike' | null>(null)
  const [isHovered, setIsHovered] = useState(false)

  const relevance = article.summary?.relevanceScore ?? 0
  const sentiment = article.summary?.sentimentScore ?? null
  const topics = article.summary?.keyTopics ?? []
  const excerpt = article.summary?.content?.slice(0, 200) ?? ''

  const relevanceColor =
    relevance > 0.7 ? '#22c55e' : relevance > 0.4 ? '#6366f1' : '#8a8a8a'

  function handleFeedback(type: 'like' | 'dislike') {
    if (feedbackGiven) return
    setFeedbackGiven(type)
    onFeedback?.(article.id, type)

    fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articleId: article.id, type, topics }),
    }).catch(() => {})
  }

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        backgroundColor: isHovered ? '#141414' : '#111111',
        border: `1px solid ${isHovered ? '#2a2a2a' : '#1f1f1f'}`,
        borderRadius: '12px',
        padding: '20px',
        transition: 'all 0.15s',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      {/* Topics */}
      {topics.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {topics.slice(0, 4).map((topic) => (
            <Badge key={topic} variant="accent" size="sm">
              {topic}
            </Badge>
          ))}
        </div>
      )}

      {/* Title */}
      <div>
        <Link
          href={`/article/${article.id}`}
          style={{
            fontSize: '15px',
            fontWeight: 600,
            color: '#f0f0f0',
            textDecoration: 'none',
            lineHeight: '1.4',
            display: 'block',
          }}
        >
          {article.title}
        </Link>
      </div>

      {/* Excerpt */}
      {excerpt && (
        <p
          style={{
            fontSize: '13px',
            color: '#8a8a8a',
            lineHeight: '1.6',
            margin: 0,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {excerpt}
        </p>
      )}

      {/* Relevance bar */}
      <ProgressBar
        value={relevance}
        max={1}
        color={relevanceColor}
        height={3}
        label="Relevance"
        showLabel
      />

      {/* Sentiment bar */}
      <SentimentBar score={sentiment} height={3} />

      {/* Footer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: '4px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: '#555' }}>{article.source.name}</span>
          <span style={{ fontSize: '11px', color: '#333' }}>·</span>
          <span style={{ fontSize: '11px', color: '#555' }}>
            {formatTimeAgo(article.scrapedAt)}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {/* External link */}
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#555',
              display: 'flex',
              alignItems: 'center',
              padding: '4px',
              borderRadius: '4px',
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = '#8a8a8a')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = '#555')}
          >
            <ExternalLinkIcon />
          </a>

          {/* Like */}
          <button
            onClick={() => handleFeedback('like')}
            disabled={!!feedbackGiven}
            style={{
              background: 'none',
              border: 'none',
              cursor: feedbackGiven ? 'default' : 'pointer',
              color: feedbackGiven === 'like' ? '#22c55e' : '#555',
              display: 'flex',
              alignItems: 'center',
              padding: '4px',
              borderRadius: '4px',
              transition: 'color 0.15s',
            }}
            title="Relevant"
          >
            <ThumbUpIcon />
          </button>

          {/* Dislike */}
          <button
            onClick={() => handleFeedback('dislike')}
            disabled={!!feedbackGiven}
            style={{
              background: 'none',
              border: 'none',
              cursor: feedbackGiven ? 'default' : 'pointer',
              color: feedbackGiven === 'dislike' ? '#ef4444' : '#555',
              display: 'flex',
              alignItems: 'center',
              padding: '4px',
              borderRadius: '4px',
              transition: 'color 0.15s',
            }}
            title="Not relevant"
          >
            <ThumbDownIcon />
          </button>
        </div>
      </div>
    </div>
  )
}
