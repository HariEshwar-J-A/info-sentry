'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { ChevronLeft, Clock } from 'lucide-react'
import { TopBar } from '@/components/shell/TopBar'
import { ChatWindow } from '@/components/chat/ChatWindow'
import { ChatInput } from '@/components/chat/ChatInput'
import { ChatSuggestions } from '@/components/chat/ChatSuggestions'
import type { Message } from '@/components/chat/MessageBubble'

function generateId() { return Math.random().toString(36).slice(2) }

interface SessionPreview {
  id: string
  title: string | null
  preview: string
  updatedAt: string
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessions, setSessions] = useState<SessionPreview[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loadingSession, setLoadingSession] = useState(false)

  // Load session list on mount
  useEffect(() => {
    fetch('/api/chat/sessions')
      .then((r) => r.json())
      .then((d) => setSessions(d as SessionPreview[]))
      .catch(() => {})
  }, [])

  const loadSession = useCallback(async (id: string) => {
    setLoadingSession(true)
    try {
      const res = await fetch(`/api/chat/sessions/${id}`)
      if (res.ok) {
        const data = (await res.json()) as { id: string; messages: { id: string; role: string; content: string }[] }
        setSessionId(data.id)
        setMessages(
          data.messages.map((m) => ({
            id: m.id,
            role: m.role.toLowerCase() as 'user' | 'assistant',
            content: m.content,
          }))
        )
        setSidebarOpen(false)
      }
    } finally { setLoadingSession(false) }
  }, [])

  const newChat = useCallback(() => {
    setMessages([])
    setSessionId(null)
    setInput('')
  }, [])

  const sendMessage = useCallback(async (content?: string) => {
    const text = content ?? input.trim()
    if (!text || isStreaming) return
    setInput('')

    const userMsg: Message = { id: generateId(), role: 'user', content: text }
    const assistantId = generateId()
    const assistantMsg: Message = { id: assistantId, role: 'assistant', content: '', isStreaming: true }

    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setIsStreaming(true)

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }))

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history, ...(sessionId ? { sessionId } : {}) }),
      })

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

      // Capture session ID from first response
      const newSid = res.headers.get('X-Session-Id')
      if (newSid && !sessionId) {
        setSessionId(newSid)
        // Add to sidebar sessions
        setSessions((prev) => [{ id: newSid, title: text.slice(0, 50), preview: '', updatedAt: new Date().toISOString() }, ...prev])
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = '', accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') break
          try {
            const token = JSON.parse(data) as string
            accumulated += token
            setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: accumulated } : m))
          } catch { /* skip */ }
        }
      }

      setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, isStreaming: false } : m))
    } catch (err) {
      console.error('Chat error:', err)
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: 'Sorry, something went wrong. Please try again.', isStreaming: false } : m
        )
      )
    } finally {
      setIsStreaming(false)
    }
  }, [input, messages, isStreaming, sessionId])

  return (
    <div style={{ height: '100vh', display: 'flex', backgroundColor: '#0a0a0a' }}>
      {/* Sessions sidebar */}
      {sidebarOpen && (
        <div style={{
          width: '260px', flexShrink: 0, borderRight: '1px solid #1f1f1f', backgroundColor: '#0d0d0d',
          display: 'flex', flexDirection: 'column', overflowY: 'auto',
        }}>
          <div style={{ padding: '16px', borderBottom: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#f0f0f0' }}>Chat History</span>
            <button onClick={newChat} style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #2a2a2a', background: 'none', color: '#8a8a8a', cursor: 'pointer' }}>
              + New
            </button>
          </div>
          {loadingSession && <div style={{ padding: '12px 16px', fontSize: '12px', color: '#555' }}>Loading…</div>}
          {sessions.map((s) => (
            <button key={s.id} onClick={() => void loadSession(s.id)}
              style={{
                padding: '12px 16px', textAlign: 'left', background: s.id === sessionId ? '#1a1a1a' : 'none',
                border: 'none', borderBottom: '1px solid #151515', cursor: 'pointer', color: s.id === sessionId ? '#f0f0f0' : '#8a8a8a',
              }}>
              <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {s.title ?? 'Chat'}
              </div>
              <div style={{ fontSize: '11px', color: '#555', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {s.preview || new Date(s.updatedAt).toLocaleDateString()}
              </div>
            </button>
          ))}
          {sessions.length === 0 && (
            <div style={{ padding: '24px 16px', fontSize: '12px', color: '#555', textAlign: 'center' }}>No chat history yet</div>
          )}
        </div>
      )}

      {/* Main chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopBar
          title="iChat"
          subtitle={sessionId ? 'Session active · responses saved' : 'AI assistant with live news context'}
          actions={
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => setSidebarOpen(!sidebarOpen)}
                style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #2a2a2a', background: sidebarOpen ? '#1a1a1a' : 'none', color: '#8a8a8a', cursor: 'pointer', fontSize: '12px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {sidebarOpen ? <><ChevronLeft size={12} /> Hide</> : <><Clock size={12} /> History</>}
                </span>
              </button>
              {messages.length > 0 && (
                <button onClick={newChat}
                  style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #2a2a2a', background: 'none', color: '#8a8a8a', cursor: 'pointer', fontSize: '12px' }}>
                  + New chat
                </button>
              )}
            </div>
          }
        />

        {messages.length === 0 ? (
          <ChatSuggestions onSelect={(p) => void sendMessage(p)} />
        ) : (
          <ChatWindow messages={messages} />
        )}

        <ChatInput
          value={input}
          onChange={setInput}
          onSubmit={() => void sendMessage()}
          disabled={isStreaming}
          placeholder={isStreaming ? 'Thinking…' : 'Ask about today\'s news…'}
        />
      </div>
    </div>
  )
}
