'use client'

import React, { useRef, useEffect } from 'react'

interface ChatInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  disabled?: boolean
  placeholder?: string
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = 'Ask about the news...',
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }, [value])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!disabled && value.trim()) onSubmit()
    }
  }

  return (
    <div
      style={{
        padding: '16px 24px 24px',
        borderTop: '1px solid #1f1f1f',
        backgroundColor: '#0a0a0a',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: '10px',
          alignItems: 'flex-end',
          backgroundColor: '#111111',
          border: '1px solid #2a2a2a',
          borderRadius: '12px',
          padding: '10px 12px',
          transition: 'border-color 0.15s',
        }}
        onFocus={() => {}}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          rows={1}
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            outline: 'none',
            resize: 'none',
            color: '#f0f0f0',
            fontSize: '14px',
            lineHeight: '1.6',
            fontFamily: 'inherit',
            minHeight: '22px',
            maxHeight: '200px',
            overflowY: 'auto',
          }}
        />
        <button
          onClick={onSubmit}
          disabled={disabled || !value.trim()}
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: disabled || !value.trim() ? '#1f1f1f' : '#6366f1',
            color: disabled || !value.trim() ? '#555' : '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: disabled || !value.trim() ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s',
            flexShrink: 0,
          }}
        >
          <SendIcon />
        </button>
      </div>
      <div style={{ fontSize: '11px', color: '#444', textAlign: 'center', marginTop: '8px' }}>
        Enter to send · Shift+Enter for newline
      </div>
    </div>
  )
}
