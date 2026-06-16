'use client'

import React from 'react'
import { Star, GitFork, Clock } from 'lucide-react'

export interface GitHubRepoData {
  id: string
  owner: string
  repoName: string
  fullName: string
  description: string | null
  url: string
  stars: number
  forks: number
  watchers: number
  language: string | null
  topics: string[]
  aiSummary: string | null
  lastPushed: string | null
  scrapedAt: string
  viewedAt: string | null
  interestId: string | null
  starDelta?: number
  forkDelta?: number
  previousStars?: number | null
  fetchCount?: number
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function timeAgo(iso: string | null): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days > 365) return `${Math.floor(days / 365)}y ago`
  if (days > 30) return `${Math.floor(days / 30)}mo ago`
  if (days > 0) return `${days}d ago`
  const hours = Math.floor(diff / 3_600_000)
  if (hours > 0) return `${hours}h ago`
  return 'just now'
}

const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178c6', JavaScript: '#f1e05a', Python: '#3572A5',
  Rust: '#dea584', Go: '#00ADD8', Java: '#b07219', 'C++': '#f34b7d',
  C: '#555555', 'C#': '#178600', Ruby: '#701516', PHP: '#4F5D95',
  Swift: '#F05138', Kotlin: '#A97BFF', Scala: '#c22d40',
  Shell: '#89e051', HTML: '#e34c26', CSS: '#563d7c', Jupyter: '#DA5B0B',
}

export function RepoCard({ repo, onViewed }: { repo: GitHubRepoData; onViewed?: (id: string) => void }) {
  const isNew = !repo.viewedAt
  const langColor = repo.language ? (LANG_COLORS[repo.language] ?? '#888') : '#555'

  function handleClick() {
    if (isNew && onViewed) {
      onViewed(repo.id)
      void fetch(`/api/github/${repo.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'viewed' }),
      })
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
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick() }}
    >
      {/* Header */}
      <div style={{ padding: '16px 18px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginBottom: '8px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
              {isNew && (
                <span style={{ fontSize: '9px', fontWeight: 700, color: '#6366f1', backgroundColor: 'rgba(99,102,241,0.15)', borderRadius: '4px', padding: '1px 6px', letterSpacing: '0.05em' }}>
                  ● NEW
                </span>
              )}
              <span style={{ fontSize: '12px', color: '#8a8a8a' }}>{repo.owner} /</span>
              <a
                href={repo.url}
                target="_blank"
                rel="noreferrer"
                onClick={e => e.stopPropagation()}
                style={{ fontSize: '15px', fontWeight: 700, color: '#f0f0f0', textDecoration: 'none' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#a5b4fc')}
                onMouseLeave={e => (e.currentTarget.style.color = '#f0f0f0')}
              >
                {repo.repoName}
              </a>
            </div>
            {repo.description && (
              <p style={{ fontSize: '13px', color: '#8a8a8a', margin: 0, lineHeight: '1.5', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                {repo.description}
              </p>
            )}
          </div>

          {/* Stars badge */}
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#1a1a1a', borderRadius: '6px', padding: '4px 8px' }}>
                <Star size={12} color="#eab308" fill="#eab308" />
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#eab308' }}>{fmtNum(repo.stars)}</span>
              </div>
              {repo.starDelta && repo.starDelta > 0 && (
                <span style={{ fontSize: '10px', color: '#22c55e', fontWeight: 700 }}>+{fmtNum(repo.starDelta)} ↑</span>
              )}
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', marginTop: '10px' }}>
          {repo.language && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: langColor, display: 'inline-block', flexShrink: 0 }} />
              <span style={{ fontSize: '12px', color: '#a0a0a0' }}>{repo.language}</span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <GitFork size={12} color="#555" />
            <span style={{ fontSize: '12px', color: '#8a8a8a' }}>{fmtNum(repo.forks)}</span>
          </div>
          {repo.lastPushed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={12} color="#555" />
              <span style={{ fontSize: '12px', color: '#555' }}>{timeAgo(repo.lastPushed)}</span>
            </div>
          )}
        </div>

        {/* Topic pills */}
        {repo.topics.length > 0 && (
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '10px' }}>
            {repo.topics.slice(0, 6).map(t => (
              <span key={t} style={{ fontSize: '10px', color: '#6366f1', backgroundColor: 'rgba(99,102,241,0.1)', borderRadius: '4px', padding: '2px 7px', fontWeight: 500 }}>
                {t}
              </span>
            ))}
            {repo.topics.length > 6 && (
              <span style={{ fontSize: '10px', color: '#555' }}>+{repo.topics.length - 6}</span>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ marginTop: 'auto', padding: '10px 18px', borderTop: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <span style={{ fontSize: '11px', color: '#444' }}>
          found {timeAgo(repo.scrapedAt)}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {repo.aiSummary && (
            <a
              href={`/github-feed/${repo.id}`}
              onClick={e => e.stopPropagation()}
              style={{ fontSize: '11px', color: '#6366f1', textDecoration: 'none', fontWeight: 600 }}
            >
              ✦ Analysis →
            </a>
          )}
          <a
            href={repo.url}
            target="_blank"
            rel="noreferrer"
            onClick={e => e.stopPropagation()}
            style={{ fontSize: '11px', color: '#555', textDecoration: 'none', fontWeight: 500 }}
          >
            GitHub →
          </a>
        </div>
      </div>
    </div>
  )
}
