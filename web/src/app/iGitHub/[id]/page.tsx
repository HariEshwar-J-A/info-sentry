'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Star, GitFork, Clock } from 'lucide-react'

interface RepoDetail {
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
  readme: string | null
  lastPushed: string | null
  scrapedAt: string
  viewedAt: string | null
  starDelta: number
  forkDelta: number
  previousStars: number | null
  fetchCount: number
}

const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178c6', JavaScript: '#f1e05a', Python: '#3572A5',
  Rust: '#dea584', Go: '#00ADD8', Java: '#b07219', 'C++': '#f34b7d',
  C: '#555555', 'C#': '#178600', Ruby: '#701516', PHP: '#4F5D95',
  Swift: '#F05138', Kotlin: '#A97BFF', Shell: '#89e051',
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

export default function RepoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [repo, setRepo] = useState<RepoDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [showFullReadme, setShowFullReadme] = useState(false)

  useEffect(() => {
    void fetch(`/api/github/${id}`)
      .then(r => r.json())
      .then((d: { repo?: RepoDetail }) => { setRepo(d.repo ?? null); setLoading(false) })
      .catch(() => setLoading(false))

    // Mark as viewed
    void fetch(`/api/github/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'viewed' }),
    })
  }, [id])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#555', fontSize: '14px' }}>Loading…</div>
      </div>
    )
  }

  if (!repo) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#555', fontSize: '14px' }}>Repository not found</div>
      </div>
    )
  }

  const langColor = repo.language ? (LANG_COLORS[repo.language] ?? '#888') : '#555'
  const readmePreview = repo.readme?.slice(0, 2500) ?? null
  const hasMoreReadme = (repo.readme?.length ?? 0) > 2500

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a', color: '#f0f0f0' }}>
      {/* Top bar */}
      <div style={{ borderBottom: '1px solid #1a1a1a', padding: '14px 32px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          onClick={() => router.push('/github-feed')}
          style={{ background: 'none', border: '1px solid #2a2a2a', borderRadius: '6px', color: '#8a8a8a', cursor: 'pointer', fontSize: '12px', padding: '5px 10px' }}
        >
          ← GitHub Feed
        </button>
        <span style={{ color: '#555', fontSize: '13px' }}>{repo.fullName}</span>
      </div>

      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '32px 32px 64px' }}>

        {/* Header */}
        <div style={{ marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '12px' }}>
            <div>
              <div style={{ fontSize: '13px', color: '#8a8a8a', marginBottom: '4px' }}>{repo.owner} /</div>
              <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#f0f0f0', margin: 0 }}>{repo.repoName}</h1>
            </div>
            <a
              href={repo.url}
              target="_blank"
              rel="noreferrer"
              style={{ flexShrink: 0, padding: '8px 16px', borderRadius: '8px', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc', textDecoration: 'none', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap' }}
            >
              View on GitHub →
            </a>
          </div>

          {repo.description && (
            <p style={{ fontSize: '15px', color: '#a0a0a0', margin: '0 0 16px', lineHeight: '1.6' }}>{repo.description}</p>
          )}

          {/* Stats row */}
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Star size={16} color="#eab308" fill="#eab308" />
              <span style={{ fontSize: '16px', fontWeight: 700, color: '#eab308' }}>{fmtNum(repo.stars)}</span>
              {repo.starDelta > 0 && (
                <span style={{ fontSize: '12px', color: '#22c55e', fontWeight: 700 }}>+{fmtNum(repo.starDelta)}</span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <GitFork size={14} color="#555" />
              <span style={{ fontSize: '14px', color: '#8a8a8a' }}>{fmtNum(repo.forks)}</span>
            </div>
            {repo.language && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: langColor, display: 'inline-block' }} />
                <span style={{ fontSize: '14px', color: '#a0a0a0' }}>{repo.language}</span>
              </div>
            )}
            {repo.lastPushed && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Clock size={13} color="#555" />
                <span style={{ fontSize: '13px', color: '#555' }}>pushed {timeAgo(repo.lastPushed)}</span>
              </div>
            )}
            <span style={{ fontSize: '13px', color: '#444' }}>found {timeAgo(repo.scrapedAt)}</span>
          </div>
        </div>

        {/* Topics */}
        {repo.topics.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '28px' }}>
            {repo.topics.map(t => (
              <span key={t} style={{ fontSize: '11px', color: '#6366f1', backgroundColor: 'rgba(99,102,241,0.1)', borderRadius: '4px', padding: '3px 9px', fontWeight: 500 }}>
                {t}
              </span>
            ))}
          </div>
        )}

        {/* AI Analysis */}
        {repo.aiSummary ? (
          <div style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.08em' }}>✦ AI Analysis</span>
              <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(99,102,241,0.2)' }} />
            </div>
            <div style={{ backgroundColor: '#0d1117', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '12px', padding: '20px 24px' }}>
              <p style={{ fontSize: '15px', color: '#c9d1d9', lineHeight: '1.8', margin: 0, whiteSpace: 'pre-wrap' }}>
                {repo.aiSummary}
              </p>
            </div>
          </div>
        ) : (
          <div style={{ marginBottom: '32px', backgroundColor: '#0d0d0d', border: '1px dashed #2a2a2a', borderRadius: '12px', padding: '20px 24px', color: '#555', fontSize: '13px' }}>
            No AI analysis yet — run the GitHub scan from the Topics page to generate one.
          </div>
        )}

        {/* README */}
        {readmePreview && (
          <div style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em' }}>README</span>
              <div style={{ flex: 1, height: '1px', backgroundColor: '#1f1f1f' }} />
            </div>
            <div style={{ backgroundColor: '#0d0d0d', border: '1px solid #1f1f1f', borderRadius: '12px', padding: '20px 24px', position: 'relative', overflow: 'hidden' }}>
              <pre style={{ fontSize: '12px', color: '#8a8a8a', lineHeight: '1.7', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'ui-monospace, monospace' }}>
                {showFullReadme ? repo.readme : readmePreview}
              </pre>
              {hasMoreReadme && !showFullReadme && (
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '80px', background: 'linear-gradient(to bottom, transparent, #0d0d0d)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: '12px' }}>
                  <button
                    onClick={() => setShowFullReadme(true)}
                    style={{ padding: '5px 14px', borderRadius: '6px', border: '1px solid #2a2a2a', background: '#111', color: '#8a8a8a', cursor: 'pointer', fontSize: '12px' }}
                  >
                    Show full README
                  </button>
                </div>
              )}
            </div>
            <div style={{ marginTop: '8px', textAlign: 'right' }}>
              <a href={repo.url} target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: '#555', textDecoration: 'none' }}>
                View formatted README on GitHub →
              </a>
            </div>
          </div>
        )}

        {/* Meta footer */}
        <div style={{ borderTop: '1px solid #1a1a1a', paddingTop: '16px', display: 'flex', gap: '20px', flexWrap: 'wrap', fontSize: '12px', color: '#444' }}>
          <span>Fetch count: {repo.fetchCount}</span>
          {repo.previousStars !== null && repo.previousStars !== undefined && (
            <span>Previous stars: {fmtNum(repo.previousStars)}</span>
          )}
          <span>Watchers: {fmtNum(repo.watchers)}</span>
          {repo.viewedAt && <span>Viewed {timeAgo(repo.viewedAt)}</span>}
        </div>
      </div>
    </div>
  )
}
