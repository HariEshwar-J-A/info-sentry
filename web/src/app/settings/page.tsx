'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Zap, Bell, BellOff, BellRing, Cog, Newspaper, Target, GitBranch, Video, Activity, BookOpen } from 'lucide-react'
import { TopBar } from '@/components/shell/TopBar'

// ─── Types ────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────

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

// ─── Push helpers (for Notifications tab) ────────────────────

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  return new Uint8Array([...raw].map(c => c.charCodeAt(0)))
}

async function subscribeToPush(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false
  const publicKey = process.env['NEXT_PUBLIC_VAPID_PUBLIC_KEY']
  if (!publicKey) return false
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return false
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as ArrayBuffer,
  })
  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sub.toJSON()),
  })
  return true
}

async function unsubscribeFromPush(): Promise<void> {
  if (!('serviceWorker' in navigator)) return
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return
  const endpoint = sub.endpoint
  await sub.unsubscribe()
  await fetch('/api/push/subscribe', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint }),
  })
}

// ─── Notification type config ─────────────────────────────────

const NOTIF_TYPES = [
  { type: 'NEW_ARTICLE',       label: 'New Article',          icon: <Newspaper size={15} />,  desc: 'When a new article is analysed' },
  { type: 'NEW_PREDICTION',    label: 'New Prediction',       icon: <Target    size={15} />,  desc: 'When a new prediction is generated' },
  { type: 'PREDICTION_VERIFIED', label: 'Prediction Verified', icon: <Target   size={15} color="#a5b4fc" />, desc: 'When a prediction outcome is confirmed' },
  { type: 'NEW_GITHUB_REPO',   label: 'New GitHub Repo',      icon: <GitBranch size={15} />,  desc: 'When a trending repo is discovered' },
  { type: 'NEW_VIDEO',         label: 'New Video',            icon: <Video     size={15} />,  desc: 'When a new video is summarised' },
  { type: 'PIPELINE_SUMMARY',  label: 'Pipeline Summary',     icon: <Activity  size={15} />,  desc: 'After each full pipeline run' },
  { type: 'SYSTEM',            label: 'Daily & Weekly Briefs', icon: <BookOpen  size={15} />,  desc: 'Daily brief at 8am · Weekly digest on Sundays' },
]

const SOUND_KEY  = 'is_sound_enabled'
const MUTED_KEY  = 'is_muted_types'

function readSoundPref(): boolean {
  try { return localStorage.getItem(SOUND_KEY) !== 'false' } catch { return true }
}

function readMutedTypes(): Set<string> {
  try {
    const raw = localStorage.getItem(MUTED_KEY)
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
  } catch { return new Set() }
}

// ─── Notifications tab ────────────────────────────────────────

function NotificationsTab() {
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [mutedTypes, setMutedTypes] = useState<Set<string>>(new Set())

  useEffect(() => {
    setSoundEnabled(readSoundPref())
    setMutedTypes(readMutedTypes())
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.ready
        .then(r => r.pushManager.getSubscription())
        .then(sub => setPushEnabled(!!sub))
        .catch(() => {})
    }
  }, [])

  async function togglePush() {
    setPushLoading(true)
    try {
      if (pushEnabled) {
        await unsubscribeFromPush()
        setPushEnabled(false)
      } else {
        const ok = await subscribeToPush()
        setPushEnabled(ok)
      }
    } catch { /* ignore */ } finally {
      setPushLoading(false)
    }
  }

  function toggleSound() {
    const next = !soundEnabled
    setSoundEnabled(next)
    try { localStorage.setItem(SOUND_KEY, String(next)) } catch { /* ignore */ }
  }

  function toggleMuted(type: string) {
    setMutedTypes(prev => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      try { localStorage.setItem(MUTED_KEY, JSON.stringify([...next])) } catch { /* ignore */ }
      return next
    })
  }

  const pushSupported = typeof window !== 'undefined' && 'PushManager' in window

  const card = (children: React.ReactNode) => (
    <div style={{ backgroundColor: '#111', border: '1px solid #1f1f1f', borderRadius: '14px', padding: '20px', marginBottom: '16px' }}>
      {children}
    </div>
  )

  const sectionTitle = (text: string) => (
    <div style={{ fontSize: '12px', fontWeight: 600, color: '#8a8a8a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '14px' }}>
      {text}
    </div>
  )

  const row = (label: string, desc: string, icon: React.ReactNode, checked: boolean, onChange: () => void) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid #1a1a1a' }}>
      <span style={{ color: '#6366f1', flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '13px', fontWeight: 500, color: checked ? '#e0e0e0' : '#666' }}>{label}</div>
        <div style={{ fontSize: '11px', color: '#555', marginTop: '1px' }}>{desc}</div>
      </div>
      <button
        onClick={onChange}
        style={{
          width: '40px', height: '22px', borderRadius: '11px', border: 'none',
          background: checked ? '#6366f1' : '#2a2a2a', cursor: 'pointer',
          position: 'relative', transition: 'background 0.2s', flexShrink: 0,
        }}
        title={checked ? 'Enabled' : 'Disabled'}
      >
        <span style={{
          position: 'absolute', top: '3px',
          left: checked ? '21px' : '3px',
          width: '16px', height: '16px', borderRadius: '50%',
          backgroundColor: '#fff', transition: 'left 0.2s',
          display: 'block',
        }} />
      </button>
    </div>
  )

  return (
    <div style={{ padding: '24px 32px', maxWidth: '680px' }}>

      {/* Push notifications */}
      {card(
        <>
          {sectionTitle('Device Push Notifications')}
          {!pushSupported ? (
            <div style={{ fontSize: '13px', color: '#555' }}>Push notifications are not supported in this browser.</div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: 500, color: pushEnabled ? '#e0e0e0' : '#666' }}>
                  {pushEnabled ? 'Push notifications are active on this device' : 'Push notifications are off'}
                </div>
                <div style={{ fontSize: '12px', color: '#555', marginTop: '4px' }}>
                  When enabled, pipeline completions, new articles, and prediction results are pushed to this device even when the app is closed.
                </div>
              </div>
              <button
                onClick={() => void togglePush()}
                disabled={pushLoading}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 16px', borderRadius: '8px',
                  border: `1px solid ${pushEnabled ? 'rgba(99,102,241,0.3)' : '#2a2a2a'}`,
                  background: pushEnabled ? 'rgba(99,102,241,0.12)' : '#1a1a1a',
                  color: pushEnabled ? '#a5b4fc' : '#8a8a8a',
                  cursor: pushLoading ? 'wait' : 'pointer', fontSize: '13px', fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                {pushLoading ? <Cog size={14} /> : pushEnabled ? <BellRing size={14} /> : <BellOff size={14} />}
                {pushEnabled ? 'Enabled' : 'Enable'}
              </button>
            </div>
          )}
        </>
      )}

      {/* In-app sound */}
      {card(
        <>
          {sectionTitle('In-App Sound')}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: 500, color: soundEnabled ? '#e0e0e0' : '#666' }}>
                Notification sound
              </div>
              <div style={{ fontSize: '12px', color: '#555', marginTop: '4px' }}>
                Plays a brief tone when new unread notifications arrive while the app is open.
              </div>
            </div>
            <button
              onClick={toggleSound}
              style={{
                width: '48px', height: '26px', borderRadius: '13px', border: 'none',
                background: soundEnabled ? '#6366f1' : '#2a2a2a', cursor: 'pointer',
                position: 'relative', transition: 'background 0.2s', flexShrink: 0,
              }}
            >
              <span style={{
                position: 'absolute', top: '4px',
                left: soundEnabled ? '25px' : '4px',
                width: '18px', height: '18px', borderRadius: '50%',
                backgroundColor: '#fff', transition: 'left 0.2s',
                display: 'block',
              }} />
            </button>
          </div>
        </>
      )}

      {/* Per-type muting */}
      {card(
        <>
          {sectionTitle('Notification Types')}
          <div style={{ fontSize: '12px', color: '#555', marginBottom: '12px' }}>
            Muted types are hidden from the unread count and won&apos;t trigger sound alerts.
            They still appear in the notifications list.
          </div>
          {NOTIF_TYPES.map(({ type, label, icon, desc }) =>
            row(label, desc, icon, !mutedTypes.has(type), () => toggleMuted(type))
          )}
          <div style={{ borderBottom: 'none' }} />
        </>
      )}

    </div>
  )
}

// ─── Agents tab ───────────────────────────────────────────────

function AgentsTab() {
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
    const id = setInterval(fetchAgents, 5000)
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
          try { appendLog(agentName, JSON.parse(raw) as LogLine) } catch { /* skip */ }
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
          try { setPipelineLogs(prev => [...prev.slice(-500), JSON.parse(raw) as LogLine]) } catch { /* skip */ }
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
    <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Run Pipeline button (top of agents tab) */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
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
            : <><Zap size={14} /> Run Full Pipeline</>}
        </button>
      </div>

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
                      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                            {agent.icon}
                          </div>
                          <div style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: runColor, border: '2px solid #111', transition: 'background-color 0.3s' }} />
                        </div>

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

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end', flexShrink: 0 }}>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            {agent.canRun && !isRunning && (
                              <button onClick={() => void handleRun(agent.name)}
                                style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: 'rgba(99,102,241,0.15)', color: '#6366f1', cursor: 'pointer', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
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
                            <button onClick={() => void handleToggle(agent.name)}
                              style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #2a2a2a', background: 'none', color: agent.isActive ? '#8a8a8a' : '#555', cursor: 'pointer', fontSize: '11px' }}
                              title={agent.isActive ? 'Pause agent' : 'Resume agent'}>
                              {agent.isActive ? '⏸ Pause' : '▶ Enable'}
                            </button>
                          </div>

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
                                onClick={async () => { await handleCronChange(agent.name, cronDraft || null); setEditingCron(null) }}
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
                                    const line = `${agent.cronSchedule} cd /path/to/info-sentry && npx tsx scripts/${agent.name}.ts`
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
  )
}

// ─── Page ─────────────────────────────────────────────────────

type Tab = 'agents' | 'notifications'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'agents',        label: 'Agents',        icon: <Zap size={14} /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell size={14} /> },
]

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('agents')

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
      <TopBar title="Settings" subtitle="Agents, models, schedules, and notification preferences" />

      {/* Tab bar */}
      <div style={{ borderBottom: '1px solid #1f1f1f', backgroundColor: '#0a0a0a', padding: '0 32px', display: 'flex', gap: '2px' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '12px 16px', border: 'none', background: 'none',
              cursor: 'pointer', fontSize: '13px', fontWeight: activeTab === tab.id ? 600 : 400,
              color: activeTab === tab.id ? '#f0f0f0' : '#555',
              borderBottom: `2px solid ${activeTab === tab.id ? '#6366f1' : 'transparent'}`,
              transition: 'all 0.15s', marginBottom: '-1px',
            }}
          >
            <span style={{ color: activeTab === tab.id ? '#6366f1' : '#555' }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'agents'        && <AgentsTab />}
      {activeTab === 'notifications' && <NotificationsTab />}
    </div>
  )
}
