'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import type { TopicCluster as TopicClusterType } from '@/lib/feed'

interface TopicClusterProps {
  cluster: TopicClusterType
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        transition: 'transform 0.2s',
      }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

export function TopicCluster({ cluster }: TopicClusterProps) {
  const [isOpen, setIsOpen] = useState(false)

  const sentimentColor =
    cluster.avgSentiment > 0.2
      ? '#22c55e'
      : cluster.avgSentiment < -0.2
      ? '#ef4444'
      : '#eab308'

  const sentimentLabel =
    cluster.avgSentiment > 0.2
      ? 'Positive'
      : cluster.avgSentiment < -0.2
      ? 'Negative'
      : 'Neutral'

  return (
    <div
      style={{
        backgroundColor: '#111111',
        border: '1px solid #1f1f1f',
        borderRadius: '12px',
        overflow: 'hidden',
        transition: 'border-color 0.15s',
      }}
    >
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'inherit',
          textAlign: 'left',
          transition: 'background-color 0.15s',
        }}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#141414')
        }
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent')
        }
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
          <Badge variant="accent" size="md">
            {cluster.topic}
          </Badge>
          <span style={{ fontSize: '12px', color: '#555' }}>
            {cluster.articleCount} article{cluster.articleCount !== 1 ? 's' : ''}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '80px' }}>
            <ProgressBar
              value={cluster.avgRelevance}
              max={1}
              color="#6366f1"
              height={3}
            />
          </div>
          <div
            style={{
              fontSize: '11px',
              color: sentimentColor,
              minWidth: '50px',
              textAlign: 'right',
            }}
          >
            {sentimentLabel}
          </div>
          <span style={{ color: '#555' }}>
            <ChevronIcon open={isOpen} />
          </span>
        </div>
      </button>

      {/* Expanded articles */}
      {isOpen && (
        <div
          style={{
            borderTop: '1px solid #1a1a1a',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          {cluster.articles.map((article) => (
            <Link
              key={article.id}
              href={`/article/${article.id}`}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '10px 12px',
                borderRadius: '8px',
                textDecoration: 'none',
                transition: 'background-color 0.15s',
                backgroundColor: 'transparent',
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLAnchorElement).style.backgroundColor = '#161616')
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'transparent')
              }
            >
              <div
                style={{
                  width: '3px',
                  height: '3px',
                  borderRadius: '50%',
                  backgroundColor: '#6366f1',
                  marginTop: '8px',
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#e0e0e0',
                    marginBottom: '2px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {article.title}
                </div>
                <div style={{ fontSize: '11px', color: '#555' }}>
                  {article.source.name} ·{' '}
                  {article.summary?.relevanceScore != null
                    ? `${Math.round(article.summary.relevanceScore * 100)}% relevant`
                    : ''}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
