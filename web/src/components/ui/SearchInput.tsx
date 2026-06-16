'use client'

import React from 'react'
import { Search } from 'lucide-react'

interface SearchInputProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  onClear?: () => void
  fullWidth?: boolean
  resultCount?: number
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  onClear,
  fullWidth = false,
  resultCount,
}: SearchInputProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: fullWidth ? '100%' : undefined }}>
      <div style={{ position: 'relative', flex: fullWidth ? 1 : undefined, width: fullWidth ? undefined : 'min(400px, 100%)' }}>
        <Search
          size={14}
          style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#555', pointerEvents: 'none' }}
        />
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            width: '100%',
            background: '#111',
            border: '1px solid #2a2a2a',
            borderRadius: '8px',
            color: '#f0f0f0',
            fontSize: '13px',
            padding: '8px 32px 8px 32px',
            outline: 'none',
            height: '36px',
            boxSizing: 'border-box',
            transition: 'border-color 0.15s',
          }}
          onFocus={e => (e.currentTarget.style.borderColor = '#6366f1')}
          onBlur={e => (e.currentTarget.style.borderColor = '#2a2a2a')}
        />
        {value && (
          <button
            onClick={() => { onChange(''); onClear?.() }}
            style={{
              position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', color: '#555', cursor: 'pointer',
              fontSize: '14px', lineHeight: 1, padding: '0 2px',
            }}
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>
      {resultCount !== undefined && value && (
        <span style={{ fontSize: '12px', color: '#555', whiteSpace: 'nowrap' }}>
          {resultCount} result{resultCount !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  )
}
