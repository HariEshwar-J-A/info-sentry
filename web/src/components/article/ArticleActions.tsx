'use client'

import React, { useState } from 'react'
import { Bookmark, Link2, Check } from 'lucide-react'

interface ArticleActionsProps {
  articleId: string
  articleUrl: string
  topics: string[]
}

export function ArticleActions({ articleId, articleUrl, topics }: ArticleActionsProps) {
  const [bookmarked, setBookmarked] = useState(false)
  const [copied, setCopied] = useState(false)

  function handleBookmark() {
    const next = !bookmarked
    setBookmarked(next)
    fetch('/api/feed/bookmark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articleId, bookmarked: next, topics }),
    }).catch(() => { setBookmarked(!next) })
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(articleUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }

  return (
    <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
      <button
        onClick={handleBookmark}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '7px 14px', borderRadius: '8px',
          border: `1px solid ${bookmarked ? 'rgba(99,102,241,0.4)' : '#2a2a2a'}`,
          background: bookmarked ? 'rgba(99,102,241,0.1)' : 'none',
          color: bookmarked ? '#6366f1' : '#8a8a8a',
          cursor: 'pointer', fontSize: '13px', fontWeight: 500,
          transition: 'all 0.15s',
        }}
      >
        <Bookmark size={14} fill={bookmarked ? '#6366f1' : 'none'} />
        {bookmarked ? 'Saved' : 'Save'}
      </button>

      <button
        onClick={() => void handleCopyLink()}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '7px 14px', borderRadius: '8px',
          border: '1px solid #2a2a2a', background: 'none',
          color: copied ? '#22c55e' : '#8a8a8a',
          cursor: 'pointer', fontSize: '13px', fontWeight: 500,
          transition: 'all 0.15s',
        }}
      >
        {copied ? <Check size={14} /> : <Link2 size={14} />}
        {copied ? 'Copied!' : 'Copy link'}
      </button>
    </div>
  )
}
