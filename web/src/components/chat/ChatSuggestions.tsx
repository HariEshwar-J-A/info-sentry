'use client'

import React from 'react'
import { Newspaper, TrendingUp, Sparkles, Globe } from 'lucide-react'
import { InfoSentryLogo } from '@/components/shell/InfoSentryLogo'

const suggestions = [
  {
    icon: <Newspaper size={18} color="#8a8a8a" />,
    title: 'Top stories today',
    prompt: 'What are the most important news stories from the last 24 hours?',
  },
  {
    icon: <TrendingUp size={18} color="#8a8a8a" />,
    title: 'Market & tech trends',
    prompt: 'What technology and market trends are emerging from recent articles?',
  },
  {
    icon: <Sparkles size={18} color="#8a8a8a" />,
    title: 'Active predictions',
    prompt: 'What predictions have been made recently and how confident are they?',
  },
  {
    icon: <Globe size={18} color="#8a8a8a" />,
    title: 'Geopolitical overview',
    prompt: 'Give me a geopolitical summary based on recent news coverage.',
  },
]

interface ChatSuggestionsProps {
  onSelect: (prompt: string) => void
}

export function ChatSuggestions({ onSelect }: ChatSuggestionsProps) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
      }}
    >
      <div style={{ marginBottom: '16px' }}>
        <InfoSentryLogo variant="badge" size={48} />
      </div>
      <h2
        style={{
          fontSize: '18px',
          fontWeight: 600,
          color: '#f0f0f0',
          margin: '0 0 6px',
          textAlign: 'center',
        }}
      >
        Info-Sentry AI
      </h2>
      <p
        style={{
          fontSize: '14px',
          color: '#8a8a8a',
          margin: '0 0 32px',
          textAlign: 'center',
          maxWidth: '320px',
        }}
      >
        Ask me anything about today&apos;s news, trends, and predictions from your intelligence feed.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '10px',
          width: '100%',
          maxWidth: '520px',
        }}
      >
        {suggestions.map((s, i) => (
          <button
            key={i}
            onClick={() => onSelect(s.prompt)}
            style={{
              backgroundColor: '#111111',
              border: '1px solid #1f1f1f',
              borderRadius: '10px',
              padding: '14px',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all 0.15s',
              color: 'inherit',
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = '#2a2a2a'
              ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = '#161616'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = '#1f1f1f'
              ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = '#111111'
            }}
          >
            <div style={{ marginBottom: '6px' }}>{s.icon}</div>
            <div style={{ fontSize: '13px', fontWeight: 500, color: '#e0e0e0', marginBottom: '3px' }}>
              {s.title}
            </div>
            <div style={{ fontSize: '11px', color: '#666', lineHeight: '1.4' }}>{s.prompt}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
