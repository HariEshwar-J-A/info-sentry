'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { TopBar } from '@/components/shell/TopBar'
import { RepoCard, type GitHubRepoData } from '@/components/github/RepoCard'
import { SourceTypeToggle } from '@/components/shell/SourceTypeToggle'
import { SearchInput } from '@/components/ui/SearchInput'
import { SegmentTabs } from '@/components/ui/SegmentTabs'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/LoadingState'

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
    <div className="page-content">
      {/* New repos banner */}
      {newCount > 0 && (
        <button
          type="button"
          onClick={() => { void fetchRepos(); setNewCount(0) }}
          style={{ marginBottom: '16px', padding: '10px 16px', backgroundColor: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'rgba(99,102,241,0.1)', textAlign: 'left', fontFamily: 'inherit' }}
        >
          <span style={{ fontSize: '13px', color: '#a5b4fc' }}>{newCount} new repos available</span>
          <span style={{ fontSize: '12px', color: '#6366f1', fontWeight: 600 }}>Refresh →</span>
        </button>
      )}

      {/* Controls */}
      <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Search + sort row */}
        <div className="controls-row">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search repos, owners, topics…"
            fullWidth
          />
          <select
            value={sort}
            onChange={e => setSort(e.target.value as SortMode)}
            style={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '13px', padding: '8px 10px', cursor: 'pointer', outline: 'none', height: '36px' }}
          >
            <option value="trending">Trending (star growth)</option>
            <option value="stars">Most Stars</option>
            <option value="forks">Most Forks</option>
            <option value="pushed">Recently Pushed</option>
            <option value="recent">🆕 Recently Found</option>
          </select>
          {unreadCount > 0 && (
            <span style={{ fontSize: '13px', color: '#8a8a8a', whiteSpace: 'nowrap' }}>
              ○ {unreadCount} unread
            </span>
          )}
          <button
            onClick={() => { void fetchRepos() }}
            style={{ padding: '8px 12px', background: 'none', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#555', cursor: 'pointer', fontSize: '13px', height: '36px' }}
            title="Refresh"
          >
            ↺
          </button>
        </div>

        {/* Language pills */}
        {languages.length > 0 && (
          <SegmentTabs
            variant="pills"
            active={langFilter ?? '__all_lang__'}
            onChange={id => setLangFilter(id === '__all_lang__' ? null : id)}
            items={[
              { id: '__all_lang__', label: 'All Languages' },
              ...languages.slice(0, 12).map(l => ({ id: l.language, label: l.language, count: l.count })),
            ]}
          />
        )}

        {/* Topic pills */}
        {allTopics.length > 0 && (
          <SegmentTabs
            variant="pills"
            active={topicFilter ?? '__all_topic__'}
            onChange={id => setTopicFilter(id === '__all_topic__' ? null : id)}
            items={[
              { id: '__all_topic__', label: 'All Topics' },
              ...allTopics.map(t => ({ id: t, label: t })),
            ]}
          />
        )}
      </div>

      {/* Count */}
      <div style={{ marginBottom: '16px', fontSize: '12px', color: '#555' }}>
        {filtered.length} repo{filtered.length !== 1 ? 's' : ''}
        {langFilter && langFilter !== '__all_lang__' ? ` · ${langFilter}` : ''}
        {topicFilter && topicFilter !== '__all_topic__' ? ` · #${topicFilter}` : ''}
        {search ? ` · "${search}"` : ''}
      </div>

      {/* Grid */}
      {loading ? (
        <LoadingState label="Loading GitHub repositories…" />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No repositories found"
          description='Run "GitHub Scan" on a topic in the Topics page to populate this feed'
        />
      ) : (
        <div className="cards-grid">
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
        title="iGitHub"
        subtitle="Trending repositories across your tracked topics"
        actions={<SourceTypeToggle active="github" />}
      />
      <Suspense>
        <GitHubFeedClient />
      </Suspense>
    </div>
  )
}
