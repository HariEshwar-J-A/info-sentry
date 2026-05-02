'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
}

interface Props {
  articleId: string
  articleTitle: string
  hasExistingInsight?: boolean
}

function genId() { return Math.random().toString(36).slice(2) }

export function ArticleChatPanel({ articleId, articleTitle, hasExistingInsight = false }: Props) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [saved, setSaved] = useState(hasExistingInsight)
  const [saving, setSaving] = useState(false)
  const [savedSummary, setSavedSummary] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || isStreaming) return
    setInput('')

    const userMsg: Message = { id: genId(), role: 'user', content: text }
    const assistantId = genId()
    const assistantMsg: Message = { id: assistantId, role: 'assistant', content: '', isStreaming: true }
    setMessages((p) => [...p, userMsg, assistantMsg])
    setIsStreaming(true)

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }))
      const res = await fetch(`/api/article/${articleId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
      })

      if (!res.ok || !res.body) throw new Error('Stream failed')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = '', acc = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') break
          try {
            acc += JSON.parse(data) as string
            setMessages((p) => p.map((m) => m.id === assistantId ? { ...m, content: acc } : m))
          } catch { /* skip */ }
        }
      }
      setMessages((p) => p.map((m) => m.id === assistantId ? { ...m, isStreaming: false } : m))
    } catch {
      setMessages((p) => p.map((m) => m.id === assistantId ? { ...m, content: 'Something went wrong. Try again.', isStreaming: false } : m))
    } finally {
      setIsStreaming(false)
    }
  }, [input, messages, isStreaming, articleId])

  const saveInsights = useCallback(async () => {
    if (messages.length === 0 || saving) return
    setSaving(true)
    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }))
      const res = await fetch(`/api/article/${articleId}/chat/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history }),
      })
      if (res.ok) {
        const { insight } = (await res.json()) as { insight: { chatSummary: string } }
        setSavedSummary(insight.chatSummary ?? '')
        setSaved(true)
        setTimeout(() => setOpen(false), 2000)
      }
    } finally {
      setSaving(false)
    }
  }, [messages, articleId, saving])

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(!open)}
        title="Chat about this article"
        style={{
          position: 'fixed',
          bottom: '28px',
          right: '28px',
          zIndex: 1000,
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(99,102,241,0.4)',
          transition: 'transform 0.2s',
        }}
      >
        <span style={{ fontSize: '20px' }}>{open ? '✕' : '💬'}</span>
        {saved && (
          <span style={{
            position: 'absolute', top: '2px', right: '2px', width: '12px', height: '12px',
            borderRadius: '50%', backgroundColor: '#22c55e', border: '2px solid #0a0a0a',
          }} />
        )}
      </button>

      {/* Panel */}
      {open && (
        <div style={{
          position: 'fixed', bottom: '90px', right: '28px', zIndex: 999,
          width: '340px', height: '500px',
          backgroundColor: '#111', border: '1px solid #2a2a2a', borderRadius: '16px',
          boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #1f1f1f', backgroundColor: '#0d0d0d' }}>
            <div style={{ fontSize: '12px', color: '#8a8a8a', marginBottom: '2px' }}>Discussing</div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#f0f0f0', lineHeight: '1.3',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {articleTitle}
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {messages.length === 0 && (
              <div style={{ color: '#555', fontSize: '13px', textAlign: 'center', marginTop: '40px' }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>💭</div>
                Share your thoughts about this article
              </div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}>
                <div style={{
                  maxWidth: '85%',
                  backgroundColor: msg.role === 'user' ? '#6366f1' : '#1a1a1a',
                  color: '#f0f0f0',
                  borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '4px 12px 12px 12px',
                  padding: '10px 12px',
                  fontSize: '13px',
                  lineHeight: '1.6',
                }}>
                  {msg.role === 'user' ? msg.content : (
                    <>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}
                        components={{
                          p: ({ children }) => <p style={{ margin: '2px 0', color: '#e0e0e0' }}>{children}</p>,
                          strong: ({ children }) => <strong style={{ color: '#f0f0f0' }}>{children}</strong>,
                          ul: ({ children }) => <ul style={{ paddingLeft: '16px', margin: '4px 0' }}>{children}</ul>,
                          li: ({ children }) => <li style={{ marginBottom: '2px', color: '#e0e0e0' }}>{children}</li>,
                          code: ({ children }) => <code style={{ backgroundColor: '#0d0d0d', borderRadius: '3px', padding: '1px 4px', fontSize: '12px', color: '#a5b4fc' }}>{children}</code>,
                        }}
                      >{msg.content}</ReactMarkdown>
                      {msg.isStreaming && <span style={{ display: 'inline-block', width: '2px', height: '12px', backgroundColor: '#6366f1', marginLeft: '2px', verticalAlign: 'middle', animation: 'pulse 0.8s infinite' }} />}
                    </>
                  )}
                </div>
              </div>
            ))}
            {savedSummary && (
              <div style={{ backgroundColor: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '8px', padding: '10px', fontSize: '12px', color: '#22c55e' }}>
                ✓ Insights saved: {savedSummary.slice(0, 100)}…
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '10px 12px', borderTop: '1px solid #1f1f1f', display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() } }}
              placeholder="Your thoughts…"
              rows={2}
              style={{
                flex: 1, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px',
                color: '#f0f0f0', fontSize: '13px', padding: '8px 10px', resize: 'none',
                outline: 'none', lineHeight: '1.5', fontFamily: 'inherit',
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <button onClick={() => void send()} disabled={isStreaming || !input.trim()}
                style={{
                  width: '32px', height: '32px', borderRadius: '8px', border: 'none',
                  backgroundColor: '#6366f1', color: '#fff', cursor: isStreaming ? 'wait' : 'pointer',
                  fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: isStreaming || !input.trim() ? 0.5 : 1,
                }}>↑</button>
              {messages.length > 0 && !saved && (
                <button onClick={() => void saveInsights()} disabled={saving}
                  title="Save insights"
                  style={{
                    width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #22c55e',
                    backgroundColor: 'transparent', color: '#22c55e', cursor: saving ? 'wait' : 'pointer',
                    fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>✓</button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
