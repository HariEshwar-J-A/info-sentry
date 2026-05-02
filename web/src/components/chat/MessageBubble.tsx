'use client'

import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

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
  const [copied, setCopied] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

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
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'flex',
        gap: '10px',
        marginBottom: '16px',
        animationName: 'fade-in',
        animationDuration: '0.2s',
        position: 'relative',
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

      <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
        {/* Copy button */}
        {isHovered && !message.isStreaming && (
          <button
            onClick={handleCopy}
            title={copied ? 'Copied!' : 'Copy'}
            style={{
              position: 'absolute',
              top: '6px',
              right: '6px',
              zIndex: 10,
              background: 'none',
              border: '1px solid #2a2a2a',
              borderRadius: '5px',
              color: copied ? '#22c55e' : '#8a8a8a',
              cursor: 'pointer',
              fontSize: '11px',
              padding: '2px 7px',
              lineHeight: '1.6',
              transition: 'color 0.15s, border-color 0.15s',
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        )}

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
          }}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => (
                <h1 style={{ fontSize: '17px', fontWeight: 700, color: '#f0f0f0', margin: '12px 0 6px' }}>{children}</h1>
              ),
              h2: ({ children }) => (
                <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#f0f0f0', margin: '10px 0 5px' }}>{children}</h2>
              ),
              h3: ({ children }) => (
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#e0e0e0', margin: '8px 0 4px' }}>{children}</h3>
              ),
              strong: ({ children }) => (
                <strong style={{ color: '#f0f0f0', fontWeight: 600 }}>{children}</strong>
              ),
              code: ({ inline, children, ...props }: { inline?: boolean; children?: React.ReactNode }) =>
                inline ? (
                  <code
                    {...props}
                    style={{
                      fontFamily: 'monospace',
                      backgroundColor: '#1a1a1a',
                      border: '1px solid #2a2a2a',
                      borderRadius: '4px',
                      padding: '1px 5px',
                      fontSize: '13px',
                      color: '#a5b4fc',
                    }}
                  >
                    {children}
                  </code>
                ) : (
                  <code
                    {...props}
                    style={{
                      display: 'block',
                      fontFamily: 'monospace',
                      backgroundColor: '#0d0d0d',
                      border: '1px solid #2a2a2a',
                      borderRadius: '8px',
                      padding: '12px 14px',
                      fontSize: '13px',
                      color: '#a5b4fc',
                      overflowX: 'auto',
                      margin: '8px 0',
                    }}
                  >
                    {children}
                  </code>
                ),
              pre: ({ children }) => (
                <pre style={{ margin: '8px 0', background: 'none', padding: 0 }}>{children}</pre>
              ),
              blockquote: ({ children }) => (
                <blockquote
                  style={{
                    borderLeft: '3px solid #6366f1',
                    margin: '8px 0',
                    paddingLeft: '12px',
                    color: '#a0a0a0',
                    fontStyle: 'italic',
                  }}
                >
                  {children}
                </blockquote>
              ),
              ul: ({ children }) => (
                <ul style={{ paddingLeft: '18px', margin: '4px 0', lineHeight: '1.6' }}>{children}</ul>
              ),
              ol: ({ children }) => (
                <ol style={{ paddingLeft: '18px', margin: '4px 0', lineHeight: '1.6' }}>{children}</ol>
              ),
              li: ({ children }) => (
                <li style={{ marginBottom: '2px', color: '#e0e0e0' }}>{children}</li>
              ),
              p: ({ children }) => (
                <p style={{ margin: '4px 0', color: '#e0e0e0' }}>{children}</p>
              ),
              a: ({ href, children }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#6366f1', textDecoration: 'underline' }}
                >
                  {children}
                </a>
              ),
            }}
          >
            {message.content}
          </ReactMarkdown>
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
