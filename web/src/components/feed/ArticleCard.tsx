'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { TrendingUp, TrendingDown, Minus, ThumbsUp, ThumbsDown, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { SentimentBar } from './SentimentBar'
import type { ArticleWithSummary } from '@/lib/feed'

interface ArticleCardProps {
  article: ArticleWithSummary
  onFeedback?: (articleId: string, type: 'like' | 'dislike') => void
}

function SentimentIcon({ sentiment }: { sentiment: string }) {
  if (sentiment === 'positive' || sentiment === 'excited') return <TrendingUp size={14} color="#22c55e" />
  if (sentiment === 'concerned' || sentiment === 'negative') return <TrendingDown size={14} color="#ef4444" />
  return <Minus size={14} color="#8a8a8a" />
}

function formatTimeAgo(date: Date | string): string {
  const diff = Date.now() - new Date(date).getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (hours > 48) return `${Math.floor(hours / 24)}d ago`
  if (hours > 0) return `${hours}h ago`
  return `${Math.floor(diff / (1000 * 60))}m ago`
}

export function ArticleCard({ article, onFeedback }: ArticleCardProps) {
  const [feedbackGiven, setFeedbackGiven] = useState<'like' | 'dislike' | null>(null)
  const [isHovered, setIsHovered] = useState(false)

  const relevance = article.summary?.relevanceScore ?? 0
  const sentiment = article.summary?.sentimentScore ?? null
  const topics = article.summary?.keyTopics ?? []
  const excerpt = article.summary?.content?.slice(0, 200) ?? ''
  const predictions = article.predictions ?? []
  const insightSentiment = article.insight?.userSentiment ?? null
  const relevanceColor = relevance > 0.7 ? '#22c55e' : relevance > 0.4 ? '#6366f1' : '#8a8a8a'
  const isNew = !article.viewedAt
  const displayDate = article.publishedAt ?? article.scrapedAt

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
        gap: '10px',
      }}
    >
      {/* Topics + badges */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
        {isNew && (
          <span title="New" style={{
            display: 'inline-flex', alignItems: 'center', gap: '3px',
            fontSize: '10px', fontWeight: 700, color: '#6366f1',
            backgroundColor: 'rgba(99,102,241,0.12)', borderRadius: '4px',
            padding: '1px 5px', flexShrink: 0,
          }}>● NEW</span>
        )}
        {topics.slice(0, 3).map((topic) => (
          <Badge key={topic} variant="accent" size="sm">{topic}</Badge>
        ))}
        {insightSentiment && (
          <span title={`You felt: ${insightSentiment}`} style={{ marginLeft: '4px', display: 'inline-flex', alignItems: 'center' }}>
            <SentimentIcon sentiment={insightSentiment} />
          </span>
        )}
      </div>

      {/* Title */}
      <Link
        href={`/article/${article.id}`}
        onClick={() => { if (isNew) fetch(`/api/articles/${article.id}/viewed`, { method: 'POST' }).catch(() => {}) }}
        style={{ fontSize: '15px', fontWeight: 600, color: '#f0f0f0', textDecoration: 'none', lineHeight: '1.4', display: 'block' }}
      >
        {article.title}
      </Link>

      {/* Excerpt */}
      {excerpt && (
        <p style={{ fontSize: '13px', color: '#8a8a8a', lineHeight: '1.6', margin: 0, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {excerpt}
        </p>
      )}

      {/* Predictions strip */}
      {predictions.length > 0 && (
        <div style={{ borderTop: '1px solid #1a1a1a', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Predictions</span>
          {predictions.slice(0, 2).map((pred) => (
            <div key={pred.id} style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
              <span style={{
                fontSize: '10px', fontWeight: 600, padding: '1px 5px', borderRadius: '4px', flexShrink: 0, marginTop: '1px',
                backgroundColor: pred.confidence > 0.7 ? 'rgba(34,197,94,0.15)' : pred.confidence > 0.5 ? 'rgba(234,179,8,0.15)' : 'rgba(239,68,68,0.15)',
                color: pred.confidence > 0.7 ? '#22c55e' : pred.confidence > 0.5 ? '#eab308' : '#ef4444',
              }}>
                {Math.round(pred.confidence * 100)}%
              </span>
              <span style={{ fontSize: '12px', color: '#8a8a8a', lineHeight: '1.4' }}>
                {pred.content.slice(0, 70)}{pred.content.length > 70 ? '…' : ''}
              </span>
            </div>
          ))}
          {predictions.length > 2 && (
            <span style={{ fontSize: '11px', color: '#555' }}>+{predictions.length - 2} more</span>
          )}
        </div>
      )}

      {/* Bars */}
      <ProgressBar value={relevance} max={1} color={relevanceColor} height={3} label="Relevance" showLabel />
      <SentimentBar score={sentiment} height={3} />

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11px', color: '#555' }}>{article.source.name}</span>
          <span style={{ fontSize: '11px', color: '#333' }}>·</span>
          <span style={{ fontSize: '11px', color: '#555' }}>{formatTimeAgo(displayDate)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <a href={article.url} target="_blank" rel="noopener noreferrer"
            style={{ color: '#555', display: 'flex', alignItems: 'center', padding: '4px', borderRadius: '4px' }}>
            <ExternalLink size={12} />
          </a>
          <button onClick={() => handleFeedback('like')} disabled={!!feedbackGiven}
            style={{ background: 'none', border: 'none', cursor: feedbackGiven ? 'default' : 'pointer', color: feedbackGiven === 'like' ? '#22c55e' : '#555', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center' }} title="Relevant">
            <ThumbsUp size={14} />
          </button>
          <button onClick={() => handleFeedback('dislike')} disabled={!!feedbackGiven}
            style={{ background: 'none', border: 'none', cursor: feedbackGiven ? 'default' : 'pointer', color: feedbackGiven === 'dislike' ? '#ef4444' : '#555', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center' }} title="Not relevant">
            <ThumbsDown size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
