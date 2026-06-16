'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Search, Brain, Target, ShieldCheck,
  Star, Bot, Tv, Film,
  FileText, Newspaper, TrendingUp, TrendingDown,
  MessageCircle, BarChart2, Play,
} from 'lucide-react'
import { LoadingState } from '@/components/ui/LoadingState'

const AGENT_ICONS: Record<string, React.ReactNode> = {
  Search:      <Search size={18} />,
  Brain:       <Brain size={18} />,
  Target:      <Target size={18} />,
  ShieldCheck: <ShieldCheck size={18} />,
  Star:        <Star size={18} />,
  Bot:         <Bot size={18} />,
  Tv:          <Tv size={18} />,
  Film:        <Film size={18} />,
  FileText:    <FileText size={18} />,
  Newspaper:   <Newspaper size={18} />,
  TrendingUp:  <TrendingUp size={18} />,
  TrendingDown:<TrendingDown size={18} />,
  MessageCircle: <MessageCircle size={18} />,
  BarChart2:   <BarChart2 size={18} />,
}
import { TopBar } from '@/components/shell/TopBar'

interface BudgetSettings {
  spentUsd: number
  budgetUsd: number
  percent: number
  mode: 'global' | 'per_user'
  globalCapUsd: number
  defaultPerUserCapUsd: number
}

interface AgentInfo {
  name: string
  label: string
  description: string
  icon: string
  group: string
  canRun: boolean
  defaultModel: string
  currentModel: string
  defaultCron: string | null
  cronSchedule: string | null
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
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines])

  if (lines.length === 0) return null

  return (
    <div style={{ backgroundColor: '#050505', border: '1px solid #1a1a1a', borderRadius: '10px', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid #1a1a1a', backgroundColor: '#0a0a0a' }}>
        <span style={{ fontSize: '11px', color: '#555', fontFamily: 'monospace' }}>Output</span>
        <button onClick={onClear} style={{ fontSize: '11px', color: '#555', background: 'none', border: 'none', cursor: 'pointer' }}>Clear</button>
      </div>
      <div ref={scrollRef} style={{ maxHeight: '300px', overflowY: 'auto', padding: '10px 14px', fontFamily: 'monospace', fontSize: '12px', lineHeight: '1.6' }}>
        {lines.map((l, i) => (
          <div key={i} style={{ color: l.type === 'error' ? '#ef4444' : l.type === 'stderr' ? '#ef4444' : l.type === 'system' ? '#6366f1' : '#a0a0a0', marginBottom: '1px' }}>
            {l.type === 'system' ? `  ${l.text}` : l.type === 'stderr' ? `✗ ${l.text}` : `  ${l.text}`}
          </div>
        ))}
      </div>
    </div>
  )
}

const GROUP_LABELS: Record<string, string> = {
  news: 'News Pipeline',
  github: 'GitHub Pipeline',
  video: 'Video Pipeline',
  maintenance: 'Maintenance',
  system: 'System / Event-driven',
}

function describeCron(expr: string): string {
  if (!expr) return ''
  const parts = expr.trim().split(/\s+/)
  if (parts.length !== 5) return expr
  const [min, hour, dom, month, dow] = parts
  if (min === '0' && hour === '8' && dom === '*' && month === '*' && dow === '*') return 'Daily at 8:00am'
  if (min === '0' && hour === '19' && dom === '*' && month === '*' && dow === '0') return 'Sundays at 7:00pm'
  if (min === '0' && dom === '*' && month === '*' && dow === '*') {
    const h = parseInt(hour)
    if (hour.startsWith('*/')) return `Every ${hour.slice(2)}h`
    if (!isNaN(h)) return `Daily at ${h}:00${h < 12 ? 'am' : 'pm'}`
  }
  if (min.startsWith('*/')) return `Every ${min.slice(2)} min`
  if (hour.startsWith('*/') && min === '0') return `Every ${hour.slice(2)} hours`
  if (hour.startsWith('*/')) return `Every ${hour.slice(2)} hours at :${min.padStart(2, '0')}`
  if (dow === '1' && dom === '*') {
    const h = parseInt(hour)
    return `Mondays at ${!isNaN(h) ? h : hour}:${min.padStart(2, '0')}${!isNaN(h) && h < 12 ? 'am' : 'pm'}`
  }
  return expr
}

function BetaFeatures() {
  const [predictions, setPredictions] = useState(false)

  useEffect(() => {
    setPredictions(localStorage.getItem('infosentry_beta_predictions') === 'true')
  }, [])

  function toggle(key: string, value: boolean, setter: (v: boolean) => void) {
    setter(value)
    localStorage.setItem(key, String(value))
  }

  return (
    <div>
      <div style={{ fontSize: '11px', color: '#555', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
        Beta Features
      </div>
      <div style={{ backgroundColor: '#111', border: '1px solid #1f1f1f', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 500, color: '#e0e0e0', display: 'flex', alignItems: 'center', gap: '6px' }}>
              iPredictions
              <span style={{ fontSize: '9px', color: '#6366f1', background: 'rgba(99,102,241,0.15)', borderRadius: '3px', padding: '1px 5px', fontWeight: 700 }}>BETA</span>
            </div>
            <div style={{ fontSize: '12px', color: '#555', marginTop: '3px' }}>
              AI-generated forecasts with confidence scores and evidence tracking. Experimental.
            </div>
          </div>
          <button
            onClick={() => toggle('infosentry_beta_predictions', !predictions, setPredictions)}
            style={{
              flexShrink: 0, width: '40px', height: '22px', borderRadius: '11px',
              background: predictions ? '#6366f1' : '#2a2a2a',
              border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
            }}
          >
            <span style={{
              position: 'absolute', top: '3px', left: predictions ? '21px' : '3px',
              width: '16px', height: '16px', borderRadius: '50%',
              background: '#fff', transition: 'left 0.2s',
            }} />
          </button>
        </div>
        <div style={{ fontSize: '11px', color: '#444', marginTop: '12px' }}>
          Changes take effect after page reload. Beta features may be unstable.
        </div>
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
  const [editingCron, setEditingCron] = useState<string | null>(null)
  const [cronDraft, setCronDraft] = useState('')
  const abortRefs = useRef<Record<string, AbortController>>({})

  // Budget settings
  const [budget, setBudget] = useState<BudgetSettings | null>(null)
  const [budgetSaving, setBudgetSaving] = useState(false)
  const [budgetDraft, setBudgetDraft] = useState<Partial<BudgetSettings>>({})
  const [isAdmin, setIsAdmin] = useState(false)

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

  useEffect(() => {
    fetch('/api/budget')
      .then(r => r.json())
      .then((d: BudgetSettings) => {
        setBudget(d)
        setBudgetDraft({ mode: d.mode, globalCapUsd: d.globalCapUsd, defaultPerUserCapUsd: d.defaultPerUserCapUsd })
      })
      .catch(() => {})
    // Check admin status via a PATCH probe — 403 = not admin, 200/422 = admin
    fetch('/api/budget', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      .then(r => setIsAdmin(r.status !== 403))
      .catch(() => {})
  }, [])

  async function saveBudget() {
    setBudgetSaving(true)
    try {
      const res = await fetch('/api/budget', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(budgetDraft),
      })
      if (res.ok) {
        const d = await res.json() as BudgetSettings
        setBudget(prev => prev ? { ...prev, ...d } : prev)
        setBudgetDraft({ mode: d.mode, globalCapUsd: d.globalCapUsd, defaultPerUserCapUsd: d.defaultPerUserCapUsd })
      }
    } finally {
      setBudgetSaving(false)
    }
  }

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

  async function handleCronChange(agentName: string, cronSchedule: string | null) {
    await fetch(`/api/agents/${agentName}/cron`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cronSchedule }),
    })
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
              : <><Play size={14} /> Run Full Pipeline</>}
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

        {/* Budget settings card */}
        {budget && (
          <div>
            <div style={{ fontSize: '11px', color: '#555', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
              AI Budget
            </div>
            <div style={{ backgroundColor: '#111', border: '1px solid #1f1f1f', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Spend meter */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', color: '#8a8a8a' }}>This month</span>
                  <span style={{ fontSize: '12px', color: '#f0f0f0', fontFamily: 'monospace' }}>
                    ${budget.spentUsd.toFixed(4)} / ${budget.budgetUsd.toFixed(2)}
                  </span>
                </div>
                <div style={{ height: '4px', backgroundColor: '#1a1a1a', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: '2px', transition: 'width 0.4s',
                    width: `${Math.min(budget.percent, 100)}%`,
                    backgroundColor: budget.percent > 80 ? '#ef4444' : budget.percent > 60 ? '#eab308' : '#6366f1',
                  }} />
                </div>
                <div style={{ fontSize: '11px', color: '#555', marginTop: '4px' }}>{budget.percent.toFixed(1)}% used</div>
              </div>

              {/* Mode toggle + cap editors (admin only) */}
              {isAdmin ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: '#8a8a8a', minWidth: '90px' }}>Mode</span>
                    {(['global', 'per_user'] as const).map(m => (
                      <button key={m} onClick={() => setBudgetDraft(p => ({ ...p, mode: m }))}
                        style={{
                          padding: '4px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', border: 'none',
                          background: budgetDraft.mode === m ? '#6366f1' : '#1a1a1a',
                          color: budgetDraft.mode === m ? '#fff' : '#8a8a8a',
                          fontWeight: budgetDraft.mode === m ? 600 : 400,
                        }}>
                        {m === 'global' ? 'Global cap' : 'Per user'}
                      </button>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#8a8a8a' }}>
                      Global cap ($)
                      <input type="number" min="0.01" step="0.10" value={budgetDraft.globalCapUsd ?? budget.globalCapUsd}
                        onChange={e => setBudgetDraft(p => ({ ...p, globalCapUsd: parseFloat(e.target.value) }))}
                        style={{ width: '80px', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '6px', color: '#f0f0f0', fontSize: '12px', padding: '4px 8px', fontFamily: 'monospace', outline: 'none' }}
                      />
                    </label>
                    {budgetDraft.mode === 'per_user' && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#8a8a8a' }}>
                        Default per-user cap ($)
                        <input type="number" min="0.01" step="0.10" value={budgetDraft.defaultPerUserCapUsd ?? budget.defaultPerUserCapUsd}
                          onChange={e => setBudgetDraft(p => ({ ...p, defaultPerUserCapUsd: parseFloat(e.target.value) }))}
                          style={{ width: '80px', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '6px', color: '#f0f0f0', fontSize: '12px', padding: '4px 8px', fontFamily: 'monospace', outline: 'none' }}
                        />
                      </label>
                    )}
                  </div>

                  <button onClick={() => void saveBudget()} disabled={budgetSaving}
                    style={{ alignSelf: 'flex-start', padding: '6px 16px', borderRadius: '6px', border: 'none', background: '#6366f1', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: budgetSaving ? 'wait' : 'pointer', opacity: budgetSaving ? 0.7 : 1 }}>
                    {budgetSaving ? 'Saving…' : 'Save budget settings'}
                  </button>
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: '#555' }}>Budget mode: <span style={{ color: '#8a8a8a' }}>{budget.mode === 'global' ? 'Global cap' : 'Per user'}</span></div>
              )}
            </div>
          </div>
        )}

        {/* Beta Features */}
        <BetaFeatures />

        {/* Agent cards grouped by pipeline */}
        {loading ? (
          <LoadingState label="Loading agents…" />
        ) : (
          Object.entries(GROUP_LABELS).map(([groupKey, groupLabel]) => {
            const groupAgents = agents.filter(a => a.group === groupKey)
            if (groupAgents.length === 0) return null
            return (
              <div key={groupKey}>
                <div style={{ fontSize: '11px', color: '#555', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
                  {groupLabel}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {groupAgents.map(agent => {
              const logs = agentLogs[agent.name] ?? []
              const isRunning = agent.isRunning
              const runColor = isRunning ? '#22c55e' : agent.isActive ? '#555' : '#333'

              return (
                <div key={agent.name} style={{ backgroundColor: '#111', border: `1px solid ${isRunning ? 'rgba(34,197,94,0.25)' : '#1f1f1f'}`, borderRadius: '14px', overflow: 'hidden', transition: 'border-color 0.3s' }}>
                  {/* Card header */}
                  <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                    {/* Icon + running indicator */}
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1' }}>
                        {AGENT_ICONS[agent.icon] ?? <Search size={18} />}
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

                  {/* Cron schedule editor */}
                  {agent.defaultCron !== null && (
                    <div style={{ borderTop: '1px solid #1a1a1a', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '11px', color: '#555', minWidth: '80px' }}>Schedule</span>
                      {editingCron === agent.name ? (
                        <>
                          <input
                            value={cronDraft}
                            onChange={e => setCronDraft(e.target.value)}
                            placeholder="cron expression  e.g. 0 8 * * *"
                            style={{ fontFamily: 'monospace', fontSize: '12px', padding: '4px 10px', borderRadius: '6px', border: '1px solid #6366f1', background: '#0d0d0d', color: '#f0f0f0', outline: 'none', width: '180px' }}
                          />
                          <span style={{ fontSize: '11px', color: '#6366f1' }}>{describeCron(cronDraft)}</span>
                          <button
                            onClick={async () => {
                              await handleCronChange(agent.name, cronDraft || null)
                              setEditingCron(null)
                            }}
                            style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '5px', border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer' }}
                          >Save</button>
                          <button
                            onClick={() => setEditingCron(null)}
                            style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '5px', border: '1px solid #2a2a2a', background: 'none', color: '#555', cursor: 'pointer' }}
                          >Cancel</button>
                        </>
                      ) : (
                        <>
                          <code style={{ fontFamily: 'monospace', fontSize: '11px', color: '#6366f1', backgroundColor: '#0d0d0d', borderRadius: '4px', padding: '2px 8px' }}>
                            {agent.cronSchedule ?? '—'}
                          </code>
                          {agent.cronSchedule && (
                            <span style={{ fontSize: '11px', color: '#555' }}>{describeCron(agent.cronSchedule)}</span>
                          )}
                          <button
                            onClick={() => { setCronDraft(agent.cronSchedule ?? agent.defaultCron ?? ''); setEditingCron(agent.name) }}
                            style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '5px', border: '1px solid #2a2a2a', background: 'none', color: '#8a8a8a', cursor: 'pointer' }}
                          >Edit</button>
                          {agent.cronSchedule && (
                            <button
                              onClick={async () => {
                                const line = `${agent.cronSchedule} cd /path/to/info-sentry && npx tsx scripts/${agent.name === 'daily-brief' ? 'daily-brief' : agent.name === 'weekly-digest' ? 'weekly-digest' : agent.name}.ts`
                                await navigator.clipboard.writeText(line).catch(() => {})
                              }}
                              title="Copy crontab line"
                              style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', border: '1px solid #2a2a2a', background: 'none', color: '#555', cursor: 'pointer' }}
                            >Copy crontab</button>
                          )}
                        </>
                      )}
                    </div>
                  )}

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
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
