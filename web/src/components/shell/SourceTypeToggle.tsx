'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { Newspaper, GitBranch } from 'lucide-react'

export function SourceTypeToggle({ active }: { active: 'news' | 'github' }) {
  const router = useRouter()
  const btn = (type: 'news' | 'github', label: string, icon: React.ReactNode) => (
    <button
      key={type}
      onClick={() => router.push(type === 'news' ? '/feed' : '/github-feed')}
      style={{
        padding: '6px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer',
        fontSize: '13px', fontWeight: 500,
        background: active === type ? '#1a1a1a' : 'none',
        color: active === type ? '#f0f0f0' : '#555',
        transition: 'all 0.15s',
        display: 'flex', alignItems: 'center', gap: '6px',
      }}
    >
      {icon}
      {label}
    </button>
  )
  return (
    <div style={{ display: 'flex', gap: '2px', backgroundColor: '#0d0d0d', border: '1px solid #1f1f1f', borderRadius: '8px', padding: '3px' }}>
      {btn('news', 'News', <Newspaper size={13} />)}
      {btn('github', 'GitHub', <GitBranch size={13} />)}
    </div>
  )
}
