'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { TopBar } from '@/components/shell/TopBar'
import { RepoCard, type GitHubRepoData } from '@/components/github/RepoCard'
import { SourceTypeToggle } from '@/components/shell/SourceTypeToggle'

type SortMode = 'stars' | 'forks' | 'pushed' | 'recent' | 'trending'

interface LangFacet { language: string; count: number }
interface ApiResponse { repos: GitHubRepoData[]; total: number; languages: LangFacet[] }

// ─── GitHub Feed Client ─────────────────────────────────────

function GitHubFeedClient() {
  const searchParams = useSearchParams()
  const [repos, setRepos] = useState<GitHubRepoData[]>([])
  const [languages, setLanguages] = useState<LangFacet[]>([])
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<SortMode>('trending')
  const [langFilter, setLangFilter] = useState<string | null>(null)
  const [topicFilter, setTopicFilter] = useState<string | null>(null)
  const [search, setSearch] = useState(searchParams.get('q') ?? '')
  const [newCount, setNewCount] = useState(0)

  const fetchRepos = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    const params = new URLSearchParams({ sort, limit: '100' })
    if (langFilter) params.set('language', langFilter)
    if (topicFilter) params.set('topic', topicFilter)
    try {
      const res = await fetch(`/api/github?${params}`)
      if (!res.ok) return
      const data = (await res.json()) as ApiResponse
      if (silent) {
        const newIds = new Set(repos.map(r => r.id))
        const fresh = data.repos.filter(r => !newIds.has(r.id))
        if (fresh.length > 0) setNewCount(c => c + fresh.length)
      } else {
        setRepos(data.repos)
        setLanguages(data.languages)
        setNewCount(0)
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [sort, langFilter, topicFilter, repos])

  useEffect(() => { void fetchRepos() }, [sort, langFilter, topicFilter])

  // Auto-refresh on focus
  useEffect(() => {
    const onFocus = () => { void fetchRepos(true) }
    window.addEventListener('focus', onFocus)
    const id = setInterval(() => { void fetchRepos(true) }, 90_000)
    return () => { window.removeEventListener('focus', onFocus); clearInterval(id) }
  }, [fetchRepos])

  function markViewed(id: string) {
    setRepos(prev => prev.map(r => r.id === id ? { ...r, viewedAt: new Date().toISOString() } : r))
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return repos
    const q = search.toLowerCase()
    return repos.filter(r =>
      r.repoName.toLowerCase().includes(q) ||
      r.description?.toLowerCase().includes(q) ||
      r.owner.toLowerCase().includes(q) ||
      r.topics.some(t => t.toLowerCase().includes(q))
    )
  }, [repos, search])

  const allTopics = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of repos) {
      for (const t of r.topics) counts.set(t, (counts.get(t) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([t]) => t)
  }, [repos])

  const unreadCount = repos.filter(r => !r.viewedAt).length

  return (
    <div style={{ padding: '24px 32px' }}>
      {/* New repos banner */}
      {newCount > 0 && (
        <div
          onClick={() => { void fetchRepos(); setNewCount(0) }}
          style={{ marginBottom: '16px', padding: '10px 16px', backgroundColor: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <span style={{ fontSize: '13px', color: '#a5b4fc' }}>⭐ {newCount} new repos available</span>
          <span style={{ fontSize: '12px', color: '#6366f1', fontWeight: 600 }}>Refresh →</span>
        </div>
      )}

      {/* Controls */}
      <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Search + sort row */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search repos, owners, topics…"
            style={{ flex: '1 1 200px', background: '#111', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#f0f0f0', fontSize: '14px', padding: '9px 14px', outline: 'none' }}
          />
          <select
            value={sort}
            onChange={e => setSort(e.target.value as SortMode)}
            style={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '13px', padding: '8px 10px', cursor: 'pointer', outline: 'none' }}
          >
            <option value="trending">🔥 Trending (star growth)</option>
            <option value="stars">⭐ Most Stars</option>
            <option value="forks">🔀 Most Forks</option>
            <option value="pushed">🕐 Recently Pushed</option>
            <option value="recent">🆕 Recently Found</option>
          </select>
          {unreadCount > 0 && (
            <button
              onClick={() => {/* handled by card clicks */}}
              style={{ padding: '8px 12px', borderRadius: '8px', background: 'none', border: '1px solid #2a2a2a', color: '#8a8a8a', cursor: 'default', fontSize: '13px' }}
            >
              ○ {unreadCount} unread
            </button>
          )}
          <button
            onClick={() => { void fetchRepos() }}
            style={{ padding: '8px 12px', background: 'none', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#555', cursor: 'pointer', fontSize: '13px' }}
            title="Refresh"
          >
            ↺
          </button>
        </div>

        {/* Language pills */}
        {languages.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setLangFilter(null)}
              style={{ padding: '4px 10px', borderRadius: '20px', border: `1px solid ${langFilter === null ? '#6366f1' : '#2a2a2a'}`, background: langFilter === null ? 'rgba(99,102,241,0.15)' : 'none', color: langFilter === null ? '#a5b4fc' : '#555', cursor: 'pointer', fontSize: '11px', fontWeight: 500 }}
            >
              All Languages
            </button>
            {languages.slice(0, 12).map(l => (
              <button key={l.language}
                onClick={() => setLangFilter(langFilter === l.language ? null : l.language)}
                style={{ padding: '4px 10px', borderRadius: '20px', border: `1px solid ${langFilter === l.language ? '#6366f1' : '#2a2a2a'}`, background: langFilter === l.language ? 'rgba(99,102,241,0.15)' : 'none', color: langFilter === l.language ? '#a5b4fc' : '#8a8a8a', cursor: 'pointer', fontSize: '11px' }}
              >
                {l.language} <span style={{ color: '#444' }}>{l.count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Topic pills */}
        {allTopics.length > 0 && (
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setTopicFilter(null)}
              style={{ padding: '3px 9px', borderRadius: '4px', border: `1px solid ${topicFilter === null ? '#6366f1' : '#2a2a2a'}`, background: topicFilter === null ? 'rgba(99,102,241,0.15)' : 'none', color: topicFilter === null ? '#a5b4fc' : '#555', cursor: 'pointer', fontSize: '11px' }}
            >
              All Topics
            </button>
            {allTopics.map(t => (
              <button key={t}
                onClick={() => setTopicFilter(topicFilter === t ? null : t)}
                style={{ padding: '3px 9px', borderRadius: '4px', border: `1px solid ${topicFilter === t ? '#6366f1' : '#1f1f1f'}`, background: topicFilter === t ? 'rgba(99,102,241,0.12)' : 'none', color: topicFilter === t ? '#a5b4fc' : '#6366f1', cursor: 'pointer', fontSize: '11px' }}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Count */}
      <div style={{ marginBottom: '16px', fontSize: '12px', color: '#555' }}>
        {filtered.length} repo{filtered.length !== 1 ? 's' : ''}
        {langFilter ? ` · ${langFilter}` : ''}
        {topicFilter ? ` · #${topicFilter}` : ''}
        {search ? ` · "${search}"` : ''}
      </div>

      {/* Grid */}
      {loading ? (
        <div style={{ color: '#555', fontSize: '14px', padding: '60px 0', textAlign: 'center' }}>
          <div style={{ fontSize: '28px', marginBottom: '12px' }}>⭐</div>
          Loading GitHub repositories…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 0', color: '#555' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>◎</div>
          <div style={{ fontSize: '14px' }}>No repositories found</div>
          <div style={{ fontSize: '12px', marginTop: '6px', color: '#444' }}>
            Run "⭐ GitHub Scan" on a topic in the Topics page to populate this feed
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '16px' }}>
          {filtered.map(repo => (
            <RepoCard key={repo.id} repo={repo} onViewed={markViewed} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────────

export default function GitHubFeedPage() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
      <TopBar
        title="GitHub Feed"
        subtitle="Trending repositories across your tracked topics"
        actions={<SourceTypeToggle active="github" />}
      />
      <Suspense>
        <GitHubFeedClient />
      </Suspense>
    </div>
  )
}
