'use client'

import React from 'react'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
}

interface MessageBubbleProps {
  message: Message
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginBottom: '16px',
          animationName: 'fade-in',
          animationDuration: '0.2s',
        }}
      >
        <div
          style={{
            maxWidth: '72%',
            backgroundColor: '#6366f1',
            color: '#ffffff',
            borderRadius: '16px 16px 4px 16px',
            padding: '12px 16px',
            fontSize: '14px',
            lineHeight: '1.6',
            wordBreak: 'break-word',
          }}
        >
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        gap: '10px',
        marginBottom: '16px',
        animationName: 'fade-in',
        animationDuration: '0.2s',
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: '28px',
          height: '28px',
          borderRadius: '8px',
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          flexShrink: 0,
          marginTop: '2px',
        }}
      >
        ◉
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            backgroundColor: '#111111',
            border: '1px solid #1f1f1f',
            borderRadius: '4px 16px 16px 16px',
            padding: '12px 16px',
            fontSize: '14px',
            lineHeight: '1.7',
            color: '#e0e0e0',
            wordBreak: 'break-word',
            whiteSpace: 'pre-wrap',
          }}
        >
          {message.content}
          {message.isStreaming && (
            <span
              style={{
                display: 'inline-block',
                width: '2px',
                height: '14px',
                backgroundColor: '#6366f1',
                marginLeft: '2px',
                verticalAlign: 'middle',
                animation: 'pulse-dot 0.8s ease-in-out infinite',
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
