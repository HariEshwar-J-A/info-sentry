import { spawn } from 'child_process'
import path from 'path'
import { prisma } from '@/lib/prisma'
import { REPO_ROOT } from '@/lib/agents'

type RunLineType = 'stdout' | 'stderr' | 'system' | 'error'
type RunLine = { ts: string; type: RunLineType; text: string }

interface ActiveRunState {
  runId: string
  logs: RunLine[]
  done: boolean
}

declare global {
  // eslint-disable-next-line no-var
  var __activePipelineRuns: Map<string, ActiveRunState> | undefined
}

const activePipelineRuns = global.__activePipelineRuns ?? (global.__activePipelineRuns = new Map<string, ActiveRunState>())

const IGNORED_STDERR = ["The 'path' argument is deprecated", 'Use --trace-deprecation']

function pushLog(runId: string, type: RunLineType, text: string) {
  const state = activePipelineRuns.get(runId)
  if (!state) return
  state.logs.push({ ts: new Date().toISOString(), type, text })
  if (state.logs.length > 500) state.logs.shift()
}

async function runStage(runId: string, label: string, scriptFile: string, args: string[] = []): Promise<boolean> {
  return new Promise((resolve) => {
    pushLog(runId, 'system', `▶ ${label}`)
    const child = spawn('npx', ['tsx', path.join(REPO_ROOT, scriptFile), ...args], {
      cwd: REPO_ROOT,
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    child.stdout?.on('data', (chunk: Buffer) => {
      chunk.toString().split('\n').filter(Boolean).forEach((line) => pushLog(runId, 'stdout', line))
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      chunk.toString().split('\n')
        .filter((line) => line.trim() && !IGNORED_STDERR.some((s) => line.includes(s)))
        .forEach((line) => pushLog(runId, 'stderr', line))
    })
    child.on('error', (err) => {
      pushLog(runId, 'error', `${label} error: ${err.message}`)
      resolve(false)
    })
    child.on('close', (code) => {
      pushLog(runId, 'system', `✓ ${label} finished (exit ${code ?? 0})`)
      resolve((code ?? 1) === 0)
    })
  })
}

function summarizeStats(runId: string) {
  const state = activePipelineRuns.get(runId)
  const logs = state?.logs ?? []
  const articlesProcessed = logs.filter((l) => l.type === 'stdout' && l.text.includes('[analyst] Done:')).length
  const reposFound = logs.filter((l) => l.type === 'stdout' && l.text.includes('✓')).length
  return { articlesProcessed, reposFound }
}

function buildLogTail(runId: string): string {
  const state = activePipelineRuns.get(runId)
  const lines = (state?.logs ?? []).slice(-250).map((l) => `[${l.type}] ${l.text}`)
  return lines.join('\n').slice(-8000)
}

export function getRunSnapshot(runId: string) {
  const state = activePipelineRuns.get(runId)
  if (!state) return null
  return { done: state.done, logs: state.logs }
}

export async function startNewsRun(interestId: string): Promise<string> {
  const run = await prisma.pipelineRun.create({
    data: { interestId, kind: 'NEWS', status: 'RUNNING' },
    select: { id: true },
  })

  activePipelineRuns.set(run.id, { runId: run.id, logs: [], done: false })
  pushLog(run.id, 'system', `News pipeline started for interest ${interestId}`)

  void (async () => {
    let ok = true
    try {
      ok = await runStage(run.id, 'Scout — fetch latest articles', 'scripts/scout-run.ts', [`--interestId=${interestId}`])
      if (ok) ok = await runStage(run.id, 'Analyst — analyze + post summaries', 'scripts/analyst-run.ts', [`--interestId=${interestId}`])
      if (ok) ok = await runStage(run.id, 'Predictor — generate + post predictions', 'scripts/predictor-run.ts', [`--interestId=${interestId}`])
      pushLog(run.id, 'system', ok ? '✅ News pipeline complete' : '❌ News pipeline failed')
      await prisma.pipelineRun.update({
        where: { id: run.id },
        data: {
          status: ok ? 'SUCCESS' : 'FAILED',
          finishedAt: new Date(),
          exitCode: ok ? 0 : 1,
          stats: summarizeStats(run.id),
          logTail: buildLogTail(run.id),
        },
      })
    } catch (err) {
      pushLog(run.id, 'error', (err as Error).message)
      await prisma.pipelineRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          finishedAt: new Date(),
          exitCode: 1,
          errorMessage: (err as Error).message,
          stats: summarizeStats(run.id),
          logTail: buildLogTail(run.id),
        },
      }).catch(() => {})
    } finally {
      const state = activePipelineRuns.get(run.id)
      if (state) state.done = true
    }
  })()

  return run.id
}

export async function startGithubRun(interestId: string): Promise<string> {
  const run = await prisma.pipelineRun.create({
    data: { interestId, kind: 'GITHUB', status: 'RUNNING' },
    select: { id: true },
  })

  activePipelineRuns.set(run.id, { runId: run.id, logs: [], done: false })
  pushLog(run.id, 'system', `GitHub pipeline started for interest ${interestId}`)

  void (async () => {
    let ok = true
    try {
      ok = await runStage(run.id, 'GitHub Scout — find repositories', 'scripts/github-scout.ts', [`--interestId=${interestId}`])
      if (ok) ok = await runStage(run.id, 'GitHub Analyst — generate AI summaries', 'scripts/github-analyst.ts', [`--interestId=${interestId}`, '--limit=30'])
      pushLog(run.id, 'system', ok ? '✅ GitHub pipeline complete' : '❌ GitHub pipeline failed')
      await prisma.pipelineRun.update({
        where: { id: run.id },
        data: {
          status: ok ? 'SUCCESS' : 'FAILED',
          finishedAt: new Date(),
          exitCode: ok ? 0 : 1,
          stats: summarizeStats(run.id),
          logTail: buildLogTail(run.id),
        },
      })
    } catch (err) {
      pushLog(run.id, 'error', (err as Error).message)
      await prisma.pipelineRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          finishedAt: new Date(),
          exitCode: 1,
          errorMessage: (err as Error).message,
          stats: summarizeStats(run.id),
          logTail: buildLogTail(run.id),
        },
      }).catch(() => {})
    } finally {
      const state = activePipelineRuns.get(run.id)
      if (state) state.done = true
    }
  })()

  return run.id
}
