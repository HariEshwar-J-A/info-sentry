'use client'

import React, { useState, useCallback } from 'react'
import { TopBar } from '@/components/shell/TopBar'
import { ChatWindow } from '@/components/chat/ChatWindow'
import { ChatInput } from '@/components/chat/ChatInput'
import { ChatSuggestions } from '@/components/chat/ChatSuggestions'
import type { Message } from '@/components/chat/MessageBubble'

function generateId() {
  return Math.random().toString(36).slice(2)
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)

  const sendMessage = useCallback(
    async (content?: string) => {
      const text = content ?? input.trim()
      if (!text || isStreaming) return

      setInput('')

      const userMsg: Message = { id: generateId(), role: 'user', content: text }
      const assistantId = generateId()
      const assistantMsg: Message = {
        id: assistantId,
        role: 'assistant',
        content: '',
        isStreaming: true,
      }

      setMessages((prev) => [...prev, userMsg, assistantMsg])
      setIsStreaming(true)

      try {
        const history = messages.map((m) => ({ role: m.role, content: m.content }))

        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, history }),
        })

        if (!res.ok || !res.body) {
          throw new Error(`HTTP ${res.status}`)
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let accumulated = ''

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
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: accumulated } : m
                )
              )
            } catch {
              // skip malformed chunks
            }
          }
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, isStreaming: false } : m
          )
        )
      } catch (err) {
        console.error('Chat error:', err)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: 'Sorry, something went wrong. Please try again.', isStreaming: false }
              : m
          )
        )
      } finally {
        setIsStreaming(false)
      }
    },
    [input, messages, isStreaming]
  )

  function handleSuggestion(prompt: string) {
    sendMessage(prompt)
  }

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#0a0a0a',
      }}
    >
      <TopBar title="Chat" subtitle="AI assistant with live news context" />

      {messages.length === 0 ? (
        <ChatSuggestions onSelect={handleSuggestion} />
      ) : (
        <ChatWindow messages={messages} />
      )}

      <ChatInput
        value={input}
        onChange={setInput}
        onSubmit={() => sendMessage()}
        disabled={isStreaming}
        placeholder="Ask about today's news..."
      />
    </div>
  )
}
