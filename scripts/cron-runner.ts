#!/usr/bin/env tsx
/**
 * cron-runner.ts — Daemon that reads AgentConfig.cronSchedule from the DB
 *                  and fires each agent script on its configured schedule.
 *
 * Run via LaunchAgent (com.infosentry.cron.plist) so it auto-starts and
 * restarts on crash. Schedules are re-read from DB every 5 minutes so that
 * changes made in the Settings UI take effect without a restart.
 *
 * Usage:
 *   npx tsx scripts/cron-runner.ts
 */
import 'dotenv/config'
import cron from 'node-cron'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { getScoutDb, disconnectAll } from './lib/prisma.js'

// Resolve paths relative to repo root (this file lives in scripts/)
const REPO_ROOT = resolve(import.meta.dirname, '..')

// Agent definitions: script path + default cron + default args
// Keep in sync with web/src/lib/agents.ts
const AGENT_SCRIPTS: Record<string, { script: string; defaultCron: string | null; args?: string[] }> = {
  'scout':               { script: 'scripts/scout-run.ts',            defaultCron: '0 */6 * * *' },
  'analyst':             { script: 'scripts/analyst-run.ts',          defaultCron: '30 */6 * * *' },
  'prediction':          { script: 'scripts/predictor-run.ts',        defaultCron: '0 */12 * * *' },
  'prediction-verifier': { script: 'scripts/prediction-verifier.ts',  defaultCron: '0 */6 * * *' },
  'github-scout':        { script: 'scripts/github-scout.ts',         defaultCron: '0 */12 * * *' },
  'github-analyst':      { script: 'scripts/github-analyst.ts',       defaultCron: '30 */12 * * *' },
  'youtube-scout':       { script: 'scripts/scout-youtube.ts',        defaultCron: '0 */8 * * *' },
  'video-analyst':       { script: 'scripts/video-analyst.ts',        defaultCron: '30 */8 * * *' },
  'daily-brief':         { script: 'scripts/daily-brief.ts',          defaultCron: '0 8 * * *' },
  'weekly-digest':       { script: 'scripts/weekly-digest.ts',        defaultCron: '0 19 * * 0' },
  'source-quality':      { script: 'scripts/source-quality.ts',       defaultCron: '0 3 * * 1', args: ['--apply'] },
  'interest-decay':      { script: 'scripts/interest-decay.ts',       defaultCron: '0 4 * * 1', args: ['--apply'] },
}

// Track active node-cron tasks so we can destroy + re-register on reload
const tasks = new Map<string, cron.ScheduledTask>()
const taskExpressions = new Map<string, string>()

// Track running child processes so we don't double-fire
const running = new Set<string>()

function log(msg: string) {
  console.log(`[cron-runner] ${new Date().toISOString().slice(0, 19)} ${msg}`)
}

function runAgent(name: string, scriptRelPath: string, args: string[] = []) {
  if (running.has(name)) {
    log(`⚠  ${name} already running — skipping this tick`)
    return
  }

  const scriptAbs = resolve(REPO_ROOT, scriptRelPath)
  log(`▶  ${name} — npx tsx ${scriptRelPath} ${args.join(' ')}`)

  running.add(name)
  const child = spawn('npx', ['tsx', scriptAbs, ...args], {
    cwd: REPO_ROOT,
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  child.stdout?.on('data', (d: Buffer) => process.stdout.write(d))
  child.stderr?.on('data', (d: Buffer) => process.stderr.write(d))

  child.on('close', (code) => {
    running.delete(name)
    log(`■  ${name} exited (code ${code ?? '?'})`)

    // Update lastRunAt and lastError in DB
    const db = getScoutDb()
    db.agentConfig.upsert({
      where: { agentName: name },
      update: { lastRunAt: new Date(), lastError: code !== 0 ? `Exit code ${code}` : null },
      create: { agentName: name, lastRunAt: new Date(), lastError: code !== 0 ? `Exit code ${code}` : null },
    }).catch(() => {})
  })

  child.on('error', (err) => {
    running.delete(name)
    log(`✗  ${name} spawn error: ${err.message}`)
  })
}

async function loadSchedules() {
  const db = getScoutDb()
  const configs = await db.agentConfig.findMany({
    select: { agentName: true, cronSchedule: true, isActive: true },
  })

  // Map name → effective schedule
  const scheduleMap = new Map<string, string | null>()
  for (const c of configs) {
    scheduleMap.set(c.agentName, c.isActive ? c.cronSchedule : null)
  }

  let changed = 0

  for (const [name, def] of Object.entries(AGENT_SCRIPTS)) {
    // Explicit non-null DB value wins; null or missing → use defaultCron
    const fromDb = scheduleMap.get(name)
    const effective = (fromDb !== undefined && fromDb !== null) ? fromDb : def.defaultCron

    const existing = tasks.get(name)
    const existingExpr = taskExpressions.get(name) ?? null

    if (effective === existingExpr) continue  // nothing changed

    // Destroy old task if any
    if (existing) {
      existing.stop()
      tasks.delete(name)
      taskExpressions.delete(name)
      if (effective === null) {
        log(`⏹  ${name} — schedule disabled`)
        changed++
        continue
      }
    }

    if (!effective) continue

    // Validate expression before scheduling
    if (!cron.validate(effective)) {
      log(`⚠  ${name} — invalid cron expression "${effective}" — skipping`)
      continue
    }

    const task = cron.schedule(effective, () => {
      runAgent(name, def.script, def.args ?? [])
    }, { timezone: 'America/Toronto' })

    tasks.set(name, task)
    taskExpressions.set(name, effective)
    log(`✓  ${name} scheduled: ${effective}`)
    changed++
  }

  return changed
}

async function main() {
  log('═══════════════════════════════════════')
  log('Info-Sentry Cron Runner')
  log(`Repo root: ${REPO_ROOT}`)
  log('═══════════════════════════════════════')

  // Initial load
  const n = await loadSchedules()
  log(`${n} schedules registered`)
  log(`${tasks.size} agents active`)

  // Reload schedules every 5 minutes in case the UI changed them
  const RELOAD_INTERVAL_MS = 5 * 60 * 1000
  setInterval(async () => {
    try {
      const changed = await loadSchedules()
      if (changed > 0) log(`Reloaded — ${changed} schedule(s) updated`)
    } catch (err) {
      log(`Reload error: ${(err as Error).message}`)
    }
  }, RELOAD_INTERVAL_MS)

  log('Running. Ctrl-C to stop.')
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  log('SIGTERM — stopping all tasks')
  for (const task of tasks.values()) task.stop()
  await disconnectAll()
  process.exit(0)
})

process.on('SIGINT', async () => {
  log('SIGINT — stopping all tasks')
  for (const task of tasks.values()) task.stop()
  await disconnectAll()
  process.exit(0)
})

main().catch(err => {
  console.error('[cron-runner] Fatal:', err)
  process.exit(1)
})
