'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { TopBar } from '@/components/shell/TopBar'

interface RunItem {
  id: string
  kind: 'NEWS' | 'GITHUB'
  status: 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED'
  startedAt: string
  finishedAt: string | null
  stats: Record<string, number> | null
  interest: { id: string; topic: string } | null
}

export default function RunsPage() {
  const [runs, setRuns] = useState<RunItem[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [logLines, setLogLines] = useState<string[]>([])
  const [kindFilter, setKindFilter] = useState<'all' | 'NEWS' | 'GITHUB'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED'>('all')

  useEffect(() => {
    const load = () => {
      const qp = new URLSearchParams()
      if (kindFilter !== 'all') qp.set('kind', kindFilter)
      if (statusFilter !== 'all') qp.set('status', statusFilter)
      fetch(`/api/runs?${qp.toString()}`)
        .then((r) => r.json())
        .then((d: { runs: RunItem[] }) => setRuns(d.runs ?? []))
        .catch(() => {})
    }
    load()
    const id = setInterval(load, 3000)
    return () => clearInterval(id)
  }, [kindFilter, statusFilter])

  useEffect(() => {
    const focus = new URLSearchParams(window.location.search).get('focus')
    if (focus) setSelected(focus)
  }, [])

  useEffect(() => {
    if (!selected) return
    setLogLines([])
    const es = new EventSource(`/api/runs/${selected}/stream`)
    es.onmessage = (e) => {
      if (e.data === '[DONE]') {
        es.close()
        return
      }
      setLogLines((prev) => [...prev.slice(-400), e.data])
    }
    es.onerror = () => es.close()
    return () => es.close()
  }, [selected])

  const selectedRun = useMemo(() => runs.find((r) => r.id === selected) ?? null, [runs, selected])

  const statusColor = (status: RunItem['status']) =>
    status === 'SUCCESS' ? '#22c55e' : status === 'FAILED' ? '#ef4444' : status === 'RUNNING' ? '#6366f1' : '#777'

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
      <TopBar title="Pipeline Runs" subtitle={`${runs.length} runs`} />
      <div className="page-content" style={{ display: 'grid', gap: '14px', gridTemplateColumns: 'minmax(380px, 1fr) minmax(420px, 1.2fr)' }}>
        <div style={{ background: '#111', border: '1px solid #1f1f1f', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #1a1a1a', display: 'flex', gap: '8px' }}>
            <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as 'all' | 'NEWS' | 'GITHUB')} style={{ background: '#0d0d0d', border: '1px solid #2a2a2a', color: '#bbb', borderRadius: '6px', padding: '4px 8px' }}>
              <option value="all">All kinds</option>
              <option value="NEWS">News</option>
              <option value="GITHUB">GitHub</option>
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED')} style={{ background: '#0d0d0d', border: '1px solid #2a2a2a', color: '#bbb', borderRadius: '6px', padding: '4px 8px' }}>
              <option value="all">All statuses</option>
              <option value="RUNNING">Running</option>
              <option value="SUCCESS">Success</option>
              <option value="FAILED">Failed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
          <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            {runs.map((run) => (
              <button key={run.id} onClick={() => setSelected(run.id)} style={{ width: '100%', textAlign: 'left', border: 'none', borderBottom: '1px solid #1a1a1a', background: selected === run.id ? '#141414' : 'transparent', cursor: 'pointer', padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <div style={{ color: '#ddd', fontSize: '13px', fontWeight: 600 }}>{run.interest?.topic ?? 'Unknown topic'}</div>
                  <span style={{ fontSize: '10px', color: statusColor(run.status), border: `1px solid ${statusColor(run.status)}55`, borderRadius: '999px', padding: '1px 8px' }}>{run.status}</span>
                </div>
                <div style={{ fontSize: '11px', color: '#666' }}>{run.kind} · {new Date(run.startedAt).toLocaleString()}</div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ background: '#111', border: '1px solid #1f1f1f', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #1a1a1a', color: '#bbb', fontSize: '12px' }}>
            {selectedRun ? `${selectedRun.kind} · ${selectedRun.interest?.topic ?? ''}` : 'Select a run to view logs'}
          </div>
          <div style={{ padding: '12px 14px', maxHeight: '70vh', overflowY: 'auto', fontFamily: 'monospace', fontSize: '12px', lineHeight: 1.6 }}>
            {logLines.length === 0 ? <div style={{ color: '#555' }}>No logs yet.</div> : logLines.map((line, i) => <div key={i} style={{ color: line.includes('[error]') || line.includes('[stderr]') ? '#ef4444' : '#9ca3af' }}>{line}</div>)}
          </div>
        </div>
      </div>
    </div>
  )
}
