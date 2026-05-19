'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

interface Props {
  content: string
  size?: 'sm' | 'md' | 'lg'
}

const BASE: React.CSSProperties = { margin: 0, padding: 0 }

function makeComponents(color: string): Components {
  return {
    p:          ({ children }) => <p style={{ ...BASE, marginBottom: '0.9em', color, lineHeight: '1.75' }}>{children}</p>,
    strong:     ({ children }) => <strong style={{ color: '#f0f0f0', fontWeight: 700 }}>{children}</strong>,
    em:         ({ children }) => <em style={{ color: '#c0c0c0' }}>{children}</em>,
    h1:         ({ children }) => <h1 style={{ fontSize: '1.35em', fontWeight: 700, color: '#f0f0f0', margin: '1.4em 0 0.5em', borderBottom: '1px solid #1f1f1f', paddingBottom: '0.3em' }}>{children}</h1>,
    h2:         ({ children }) => <h2 style={{ fontSize: '1.15em', fontWeight: 600, color: '#f0f0f0', margin: '1.2em 0 0.4em' }}>{children}</h2>,
    h3:         ({ children }) => <h3 style={{ fontSize: '1.05em', fontWeight: 600, color: '#e0e0e0', margin: '1em 0 0.35em' }}>{children}</h3>,
    ul:         ({ children }) => <ul style={{ margin: '0.4em 0 0.9em', paddingLeft: '1.4em', listStyleType: 'disc', color }}>{children}</ul>,
    ol:         ({ children }) => <ol style={{ margin: '0.4em 0 0.9em', paddingLeft: '1.4em', color }}>{children}</ol>,
    li:         ({ children }) => <li style={{ marginBottom: '0.2em', color }}>{children}</li>,
    blockquote: ({ children }) => <blockquote style={{ borderLeft: '3px solid #6366f1', paddingLeft: '1em', margin: '1em 0', color: '#8a8a8a', fontStyle: 'italic' }}>{children}</blockquote>,
    hr:         ()             => <hr style={{ border: 'none', borderTop: '1px solid #1f1f1f', margin: '1.4em 0' }} />,
    a:          ({ href, children }) => (
      <a href={href} target="_blank" rel="noopener noreferrer"
        style={{ color: '#818cf8', textDecoration: 'underline', textDecorationColor: 'rgba(129,140,248,0.35)' }}>
        {children}
      </a>
    ),
    // Inline code vs block code — react-markdown passes className="language-*" for blocks
    code:       ({ className, children }) => {
      const isBlock = Boolean(className)
      return isBlock
        ? (
          <pre style={{ backgroundColor: '#0d0d0d', border: '1px solid #1f1f1f', borderRadius: '8px', padding: '14px 16px', overflowX: 'auto', margin: '0.8em 0' }}>
            <code style={{ fontFamily: 'monospace', fontSize: '13px', color: '#a0a0a0' }}>{children}</code>
          </pre>
        )
        : (
          <code style={{ backgroundColor: '#1a1a1a', borderRadius: '4px', padding: '0.1em 0.4em', fontFamily: 'monospace', fontSize: '0.88em', color: '#a5b4fc' }}>
            {children}
          </code>
        )
    },
    // Suppress the extra <pre> wrapper react-markdown adds around code blocks
    pre:        ({ children }) => <>{children}</>,
  }
}

export function MarkdownContent({ content, size = 'md' }: Props) {
  const fontSize = size === 'sm' ? '13px' : size === 'lg' ? '17px' : '15px'
  const color    = size === 'sm' ? '#8a8a8a' : '#d0d0d0'

  return (
    <div style={{ fontSize, lineHeight: '1.75' }}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={makeComponents(color)}>
        {content}
      </ReactMarkdown>
    </div>
  )
}

/** Strip markdown syntax — use for plain-text previews / excerpts */
export function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g,     '$1')
    .replace(/^#{1,6}\s+/gm,    '')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/`(.+?)`/g,         '$1')
    .replace(/^\s*[-*+]\s+/gm,  '')
    .replace(/^\s*\d+\.\s+/gm,  '')
    .replace(/\n{2,}/g,          ' ')
    .trim()
}
