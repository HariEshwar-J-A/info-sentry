'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { TopBar } from '@/components/shell/TopBar'

interface AgentInfo {
  name: string
  label: string
  description: string
  icon: string
  canRun: boolean
  defaultModel: string
  currentModel: string
  isActive: boolean
  lastRunAt: string | null
  lastError: string | null
  isRunning: boolean
  runningFor: number | null
}

interface ModelOption {
  id: string
  name: string
  tier: string
  desc: string
}

interface LogLine {
  type: 'stdout' | 'stderr' | 'system' | 'error'
  text: string
}

const TIER_COLOR: Record<string, string> = {
  Premium: '#6366f1', Balanced: '#22c55e', Budget: '#eab308', Free: '#8a8a8a',
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3_600_000)
  if (h > 24) return `${Math.floor(h / 24)}d ago`
  if (h > 0) return `${h}h ago`
  return `${Math.floor(diff / 60_000)}m ago`
}

function LogPanel({ lines, onClear }: { lines: LogLine[]; onClear: () => void }) {
  const bottomRef = useRef<HTMLDivElement>(null)
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [lines])

  if (lines.length === 0) return null

  return (
    <div style={{ backgroundColor: '#050505', border: '1px solid #1a1a1a', borderRadius: '10px', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid #1a1a1a', backgroundColor: '#0a0a0a' }}>
        <span style={{ fontSize: '11px', color: '#555', fontFamily: 'monospace' }}>Output</span>
        <button onClick={onClear} style={{ fontSize: '11px', color: '#555', background: 'none', border: 'none', cursor: 'pointer' }}>Clear</button>
      </div>
      <div style={{ maxHeight: '300px', overflowY: 'auto', padding: '10px 14px', fontFamily: 'monospace', fontSize: '12px', lineHeight: '1.6' }}>
        {lines.map((l, i) => (
          <div key={i} style={{ color: l.type === 'error' ? '#ef4444' : l.type === 'stderr' ? '#ef4444' : l.type === 'system' ? '#6366f1' : '#a0a0a0', marginBottom: '1px' }}>
            {l.type === 'system' ? `  ${l.text}` : l.type === 'stderr' ? `✗ ${l.text}` : `  ${l.text}`}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [models, setModels] = useState<ModelOption[]>([])
  const [loading, setLoading] = useState(true)
  const [agentLogs, setAgentLogs] = useState<Record<string, LogLine[]>>({})
  const [pipelineLogs, setPipelineLogs] = useState<LogLine[]>([])
  const [pipelineRunning, setPipelineRunning] = useState(false)
  const [savingModel, setSavingModel] = useState<string | null>(null)
  const abortRefs = useRef<Record<string, AbortController>>({})

  const fetchAgents = useCallback(() => {
    fetch('/api/agents')
      .then(r => r.json())
      .then((d: { agents: AgentInfo[]; models: ModelOption[] }) => {
        setAgents(d.agents ?? [])
        setModels(d.models ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchAgents()
    const id = setInterval(fetchAgents, 5000) // poll every 5s for live status
    return () => clearInterval(id)
  }, [fetchAgents])

  async function handleModelChange(agentName: string, modelId: string) {
    setSavingModel(agentName)
    await fetch(`/api/agents/${agentName}/model`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modelId }),
    })
    setSavingModel(null)
    fetchAgents()
  }

  async function handleToggle(agentName: string) {
    await fetch(`/api/agents/${agentName}/toggle`, { method: 'POST' })
    fetchAgents()
  }

  async function handleStop(agentName: string) {
    abortRefs.current[agentName]?.abort()
    await fetch(`/api/agents/${agentName}/stop`, { method: 'POST' })
    fetchAgents()
  }

  function appendLog(agentName: string, line: LogLine) {
    setAgentLogs(prev => ({
      ...prev,
      [agentName]: [...(prev[agentName] ?? []).slice(-500), line],
    }))
  }

  async function handleRun(agentName: string) {
    const abort = new AbortController()
    abortRefs.current[agentName] = abort

    setAgentLogs(prev => ({ ...prev, [agentName]: [] }))
    fetchAgents()

    try {
      const res = await fetch(`/api/agents/${agentName}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        signal: abort.signal,
      })

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const parts = buf.split('\n')
        buf = parts.pop() ?? ''
        for (const part of parts) {
          if (!part.startsWith('data: ')) continue
          const raw = part.slice(6)
          if (raw === '[DONE]') break
          try {
            const parsed = JSON.parse(raw) as LogLine
            appendLog(agentName, parsed)
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        appendLog(agentName, { type: 'error', text: (err as Error).message })
      }
    } finally {
      fetchAgents()
    }
  }

  async function handleRestart(agentName: string) {
    await handleStop(agentName)
    await new Promise(r => setTimeout(r, 800))
    await handleRun(agentName)
  }

  async function handleRunPipeline() {
    setPipelineLogs([])
    setPipelineRunning(true)

    const abort = new AbortController()
    abortRefs.current['__pipeline__'] = abort

    try {
      const res = await fetch('/api/pipeline/run', { method: 'POST', signal: abort.signal })
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const parts = buf.split('\n')
        buf = parts.pop() ?? ''
        for (const part of parts) {
          if (!part.startsWith('data: ')) continue
          const raw = part.slice(6)
          if (raw === '[DONE]') break
          try {
            const parsed = JSON.parse(raw) as LogLine
            setPipelineLogs(prev => [...prev.slice(-500), parsed])
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setPipelineLogs(prev => [...prev, { type: 'error', text: (err as Error).message }])
      }
    } finally {
      setPipelineRunning(false)
      fetchAgents()
    }
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
      <TopBar
        title="Settings"
        subtitle="Agent control, model selection, and manual pipeline runs"
        actions={
          <button
            onClick={() => void handleRunPipeline()}
            disabled={pipelineRunning}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px', borderRadius: '8px', border: 'none',
              background: pipelineRunning ? '#1a1a1a' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: pipelineRunning ? '#8a8a8a' : '#fff', cursor: pipelineRunning ? 'wait' : 'pointer',
              fontSize: '13px', fontWeight: 600, transition: 'all 0.15s',
            }}
          >
            {pipelineRunning
              ? <><span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#6366f1', animation: 'pulse 1s infinite' }} /> Running…</>
              : '⚡ Run Full Pipeline'}
          </button>
        }
      />

      <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
        {/* Pipeline output */}
        {pipelineLogs.length > 0 && (
          <div>
            <div style={{ fontSize: '12px', color: '#555', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pipeline Output</div>
            <LogPanel lines={pipelineLogs} onClear={() => setPipelineLogs([])} />
          </div>
        )}

        {/* Agent cards */}
        {loading ? (
          <div style={{ color: '#555', fontSize: '14px', padding: '40px 0' }}>Loading agents…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {agents.map(agent => {
              const logs = agentLogs[agent.name] ?? []
              const isRunning = agent.isRunning
              const runColor = isRunning ? '#22c55e' : agent.isActive ? '#555' : '#333'

              return (
                <div key={agent.name} style={{ backgroundColor: '#111', border: `1px solid ${isRunning ? 'rgba(34,197,94,0.25)' : '#1f1f1f'}`, borderRadius: '14px', overflow: 'hidden', transition: 'border-color 0.3s' }}>
                  {/* Card header */}
                  <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                    {/* Icon + running indicator */}
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                        {agent.icon}
                      </div>
                      <div style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: runColor, border: '2px solid #111', transition: 'background-color 0.3s' }} />
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                        <span style={{ fontSize: '15px', fontWeight: 600, color: '#f0f0f0' }}>{agent.label}</span>
                        {isRunning && (
                          <span style={{ fontSize: '10px', color: '#22c55e', backgroundColor: 'rgba(34,197,94,0.12)', borderRadius: '4px', padding: '1px 6px', fontWeight: 700 }}>
                            ● RUNNING{agent.runningFor != null ? ` ${agent.runningFor}s` : ''}
                          </span>
                        )}
                        {!agent.isActive && !isRunning && (
                          <span style={{ fontSize: '10px', color: '#555', backgroundColor: '#1a1a1a', borderRadius: '4px', padding: '1px 6px' }}>PAUSED</span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: '#8a8a8a', lineHeight: '1.4', marginBottom: '6px' }}>{agent.description}</div>
                      <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: '#555' }}>
                        <span>Last run: {timeAgo(agent.lastRunAt)}</span>
                        {agent.lastError && <span style={{ color: '#ef444480' }}>Error: {agent.lastError.slice(0, 50)}</span>}
                      </div>
                    </div>

                    {/* Controls */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end', flexShrink: 0 }}>
                      {/* Action buttons */}
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {agent.canRun && !isRunning && (
                          <button onClick={() => void handleRun(agent.name)}
                            style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: 'rgba(99,102,241,0.15)', color: '#6366f1', cursor: 'pointer', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', transition: 'all 0.15s' }}>
                            ▶ Run
                          </button>
                        )}
                        {isRunning && (
                          <>
                            <button onClick={() => void handleStop(agent.name)}
                              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
                              ⏹ Stop
                            </button>
                            <button onClick={() => void handleRestart(agent.name)}
                              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #2a2a2a', background: 'none', color: '#8a8a8a', cursor: 'pointer', fontSize: '12px' }}>
                              ↺ Restart
                            </button>
                          </>
                        )}
                        {/* Enable/disable toggle */}
                        <button onClick={() => void handleToggle(agent.name)}
                          style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #2a2a2a', background: 'none', color: agent.isActive ? '#8a8a8a' : '#555', cursor: 'pointer', fontSize: '11px', transition: 'all 0.15s' }}
                          title={agent.isActive ? 'Pause agent (disable from cron)' : 'Resume agent'}>
                          {agent.isActive ? '⏸ Pause' : '▶ Enable'}
                        </button>
                      </div>

                      {/* Model selector */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '10px', color: '#555' }}>Model:</span>
                        <select
                          value={agent.currentModel}
                          onChange={e => void handleModelChange(agent.name, e.target.value)}
                          disabled={savingModel === agent.name}
                          style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '6px', color: '#e0e0e0', fontSize: '11px', padding: '3px 6px', cursor: 'pointer', outline: 'none', maxWidth: '180px' }}
                        >
                          {models.map(m => (
                            <option key={m.id} value={m.id}>{m.name} ({m.tier})</option>
                          ))}
                        </select>
                        {savingModel === agent.name && <span style={{ fontSize: '10px', color: '#555' }}>Saving…</span>}
                      </div>
                    </div>
                  </div>

                  {/* Log output */}
                  {logs.length > 0 && (
                    <div style={{ borderTop: '1px solid #1a1a1a', padding: '12px 16px' }}>
                      <LogPanel lines={logs} onClear={() => setAgentLogs(prev => ({ ...prev, [agent.name]: [] }))} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
