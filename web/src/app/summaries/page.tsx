'use client'

import React, { useState, useEffect } from 'react'
import { BookOpen, Zap, Calendar, CheckCheck } from 'lucide-react'
import { TopBar } from '@/components/shell/TopBar'
import { MarkdownContent } from '@/components/ui/MarkdownContent'

interface SummaryItem {
  id: string
  title: string
  body: string
  data: Record<string, unknown>
  readAt: string | null
  createdAt: string
}

interface SummariesData {
  briefs:  SummaryItem[]
  digests: SummaryItem[]
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function SummaryCard({ item, onRead }: { item: SummaryItem; onRead: (id: string) => void }) {
  const [expanded, setExpanded] = useState(!item.readAt)

  function handleMarkRead() {
    fetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [item.id] }),
    }).catch(() => {})
    onRead(item.id)
  }

  return (
    <div style={{
      backgroundColor: '#111', border: `1px solid ${!item.readAt ? 'rgba(99,102,241,0.25)' : '#1f1f1f'}`,
      borderRadius: '14px', overflow: 'hidden', transition: 'border-color 0.3s',
    }}>
      {/* Card header */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            {!item.readAt && (
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#6366f1', flexShrink: 0 }} />
            )}
            <span style={{ fontSize: '15px', fontWeight: 600, color: item.readAt ? '#888' : '#f0f0f0' }}>
              {item.title}
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#555', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={11} />
            {timeLabel(item.createdAt)}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
          {!item.readAt && (
            <button
              onClick={e => { e.stopPropagation(); handleMarkRead() }}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#6366f1', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', cursor: 'pointer', padding: '4px 10px', borderRadius: '6px' }}
            >
              <CheckCheck size={12} /> Read
            </button>
          )}
          <span style={{ fontSize: '18px', color: '#555', transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'none' }}>
            ›
          </span>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ padding: '0 20px 20px', borderTop: '1px solid #1a1a1a' }}>
          <div style={{ paddingTop: '16px' }}>
            <MarkdownContent content={item.body} size="md" />
          </div>
        </div>
      )}
    </div>
  )
}

function Section({
  title, icon, items, emptyMsg, onRead,
}: {
  title: string
  icon: React.ReactNode
  items: SummaryItem[]
  emptyMsg: string
  onRead: (id: string) => void
}) {
  const unread = items.filter(i => !i.readAt).length

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
        <span style={{ color: '#6366f1' }}>{icon}</span>
        <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#f0f0f0', margin: 0 }}>{title}</h2>
        {unread > 0 && (
          <span style={{ fontSize: '11px', backgroundColor: 'rgba(99,102,241,0.15)', color: '#818cf8', borderRadius: '10px', padding: '2px 8px', fontWeight: 600 }}>
            {unread} new
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', color: '#555', fontSize: '13px', backgroundColor: '#111', border: '1px solid #1f1f1f', borderRadius: '14px' }}>
          {emptyMsg}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {items.map(item => (
            <SummaryCard key={item.id} item={item} onRead={onRead} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function SummariesPage() {
  const [data, setData] = useState<SummariesData>({ briefs: [], digests: [] })
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'briefs' | 'digests'>('briefs')

  useEffect(() => {
    fetch('/api/summaries')
      .then(r => r.json())
      .then((d: SummariesData) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  function handleRead(id: string) {
    const now = new Date().toISOString()
    setData(prev => ({
      briefs:  prev.briefs.map(i  => i.id === id ? { ...i, readAt: now } : i),
      digests: prev.digests.map(i => i.id === id ? { ...i, readAt: now } : i),
    }))
  }

  const briefUnread  = data.briefs.filter(i  => !i.readAt).length
  const digestUnread = data.digests.filter(i => !i.readAt).length

  const tabStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '10px 16px', border: 'none', background: 'none',
    cursor: 'pointer', fontSize: '13px',
    fontWeight: active ? 600 : 400,
    color: active ? '#f0f0f0' : '#555',
    borderBottom: `2px solid ${active ? '#6366f1' : 'transparent'}`,
    transition: 'all 0.15s', marginBottom: '-1px',
  })

  function Badge({ count }: { count: number }) {
    if (count === 0) return null
    return (
      <span style={{ minWidth: '18px', height: '18px', borderRadius: '9px', backgroundColor: '#6366f1', color: '#fff', fontSize: '10px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
        {count}
      </span>
    )
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
      <TopBar
        title="Summaries"
        subtitle="Daily briefs and weekly digests"
      />

      {/* Tab bar */}
      <div style={{ borderBottom: '1px solid #1f1f1f', padding: '0 32px', display: 'flex', gap: '2px' }}>
        <button onClick={() => setTab('briefs')} style={tabStyle(tab === 'briefs')}>
          <Zap size={14} /> Daily Briefs <Badge count={briefUnread} />
        </button>
        <button onClick={() => setTab('digests')} style={tabStyle(tab === 'digests')}>
          <BookOpen size={14} /> Weekly Digests <Badge count={digestUnread} />
        </button>
      </div>

      <div style={{ padding: '24px 32px', maxWidth: '800px' }}>
        {loading ? (
          <div style={{ color: '#555', fontSize: '14px', padding: '40px 0' }}>Loading summaries…</div>
        ) : tab === 'briefs' ? (
          <Section
            title="Daily Briefs"
            icon={<Zap size={16} />}
            items={data.briefs}
            emptyMsg="No daily briefs yet. They run automatically at 8am."
            onRead={handleRead}
          />
        ) : (
          <Section
            title="Weekly Digests"
            icon={<BookOpen size={16} />}
            items={data.digests}
            emptyMsg="No weekly digests yet. They run on Sundays at 7pm."
            onRead={handleRead}
          />
        )}
      </div>
    </div>
  )
}
