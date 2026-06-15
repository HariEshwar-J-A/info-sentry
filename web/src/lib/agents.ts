import { ChildProcess } from 'child_process'
import path from 'path'

// Absolute path to the repo root (web/ is process.cwd())
export const REPO_ROOT = path.resolve(process.cwd(), '..')

// Model options shown in settings
export const AVAILABLE_MODELS = [
  { id: 'moonshotai/kimi-k2.6',             name: 'Kimi K2.6',        tier: 'Premium', desc: 'Best chain-of-thought reasoning' },
  { id: 'deepseek/deepseek-v3.2',            name: 'DeepSeek V3.2',    tier: 'Balanced', desc: 'Smart, fast, cost-effective' },
  { id: 'deepseek/deepseek-r1',              name: 'DeepSeek R1',       tier: 'Premium', desc: 'Deep analysis with reasoning traces' },
  { id: 'google/gemini-2.5-flash-lite',       name: 'Gemini 2.0 Flash', tier: 'Budget', desc: 'Fast, cheap, strong default for scout/analyst' },
  { id: 'openai/gpt-4o-mini',               name: 'GPT-4o Mini',      tier: 'Budget', desc: 'Reliable budget option' },
  { id: 'meta-llama/llama-3-8b-instruct',   name: 'Llama 3 8B',       tier: 'Free', desc: 'Free tier fallback' },
]

// Agent definitions — script paths are relative to REPO_ROOT
export const AGENT_DEFS: Record<string, {
  label: string
  description: string
  icon: string
  script: string | null       // null = event-driven, cannot be run standalone
  defaultModel: string
  args?: string[]             // default args to pass to script
  defaultCron: string | null  // recommended cron schedule (null = not schedulable)
  group: 'news' | 'github' | 'video' | 'maintenance' | 'system'
}> = {
  // ── News pipeline ──────────────────────────────────────────
  scout: {
    label: 'Scout',
    description: 'Multi-source discovery + ScrapeGraph sidecar for LLM extraction',
    icon: '🔍',
    script: 'scripts/scout-run.ts',
    defaultModel: 'google/gemini-2.5-flash-lite',
    defaultCron: '0 */6 * * *',
    group: 'news',
  },
  analyst: {
    label: 'Analyst',
    description: 'Summarizes SCRAPED articles → embeddings → Telegram → marks SUMMARIZED',
    icon: '🧠',
    script: 'scripts/analyst-run.ts',
    defaultModel: 'google/gemini-2.5-flash-lite',
    defaultCron: '30 */6 * * *',
    group: 'news',
  },
  prediction: {
    label: 'Predictor',
    description: 'Generates predictions from SUMMARIZED articles → posts to Telegram',
    icon: '🎯',
    script: 'scripts/predictor-run.ts',
    defaultModel: 'moonshotai/kimi-k2.6',
    defaultCron: '0 */12 * * *',
    group: 'news',
  },
  'prediction-verifier': {
    label: 'Prediction Verifier',
    description: 'Checks tracked predictions against recent news (chain-of-thought + DuckDuckGo)',
    icon: '🔮',
    script: 'scripts/prediction-verifier.ts',
    defaultModel: 'moonshotai/kimi-k2.6',
    defaultCron: '0 */6 * * *',
    group: 'news',
  },

  // ── GitHub pipeline ────────────────────────────────────────
  'github-scout': {
    label: 'GitHub Scout',
    description: 'Discovers trending GitHub repos per topic via GitHub Search API',
    icon: '⭐',
    script: 'scripts/github-scout.ts',
    defaultModel: 'openai/gpt-4o-mini',
    defaultCron: '0 */12 * * *',
    group: 'github',
  },
  'github-analyst': {
    label: 'GitHub Analyst',
    description: 'Generates AI summaries for GitHub repos and posts new ones to Telegram',
    icon: '🤖',
    script: 'scripts/github-analyst.ts',
    defaultModel: 'google/gemini-2.5-flash-lite',
    defaultCron: '30 */12 * * *',
    group: 'github',
  },

  // ── Video pipeline ─────────────────────────────────────────
  'youtube-scout': {
    label: 'YouTube Scout',
    description: 'Polls YouTube channel RSS feeds, extracts transcripts via yt-dlp',
    icon: '📺',
    script: 'scripts/scout-youtube.ts',
    defaultModel: 'google/gemini-2.5-flash-lite',
    defaultCron: '0 */8 * * *',
    group: 'video',
  },
  'video-analyst': {
    label: 'Video Analyst',
    description: 'Generates AI summaries for videos with transcripts',
    icon: '🎬',
    script: 'scripts/video-analyst.ts',
    defaultModel: 'google/gemini-2.5-flash-lite',
    defaultCron: '30 */8 * * *',
    group: 'video',
  },

  // ── Maintenance ────────────────────────────────────────────
  'daily-brief': {
    label: 'Daily Brief',
    description: 'Personalized AI content brief → Telegram DM + web notification',
    icon: '📋',
    script: 'scripts/daily-brief.ts',
    defaultModel: 'google/gemini-2.5-flash-lite',
    defaultCron: '0 8 * * *',
    group: 'maintenance',
  },
  'weekly-digest': {
    label: 'Weekly Digest',
    description: 'Weekly intelligence recap → Telegram DM (run Sundays)',
    icon: '📰',
    script: 'scripts/weekly-digest.ts',
    defaultModel: 'google/gemini-2.5-flash-lite',
    defaultCron: '0 19 * * 0',
    group: 'maintenance',
  },
  'source-quality': {
    label: 'Source Quality',
    description: 'Auto-adjusts source trustScore based on article relevance (EMA)',
    icon: '📈',
    script: 'scripts/source-quality.ts',
    args: ['--apply'],
    defaultModel: 'openai/gpt-4o-mini',
    defaultCron: '0 3 * * 1',
    group: 'maintenance',
  },
  'interest-decay': {
    label: 'Interest Decay',
    description: 'Applies 10% score decay to interests idle for ≥14 days',
    icon: '📉',
    script: 'scripts/interest-decay.ts',
    args: ['--apply'],
    defaultModel: 'openai/gpt-4o-mini',
    defaultCron: '0 4 * * 1',
    group: 'maintenance',
  },

  // ── System / event-driven ──────────────────────────────────
  feedback: {
    label: 'Feedback',
    description: 'Processes Telegram callback signals, updates interest scores (event-driven)',
    icon: '💬',
    script: null,
    defaultModel: 'openai/gpt-4o-mini',
    defaultCron: null,
    group: 'system',
  },
  manager: {
    label: 'Manager',
    description: 'System health, budget monitoring and Telegram DM commands (event-driven)',
    icon: '📊',
    script: 'scripts/health-check.ts',
    defaultModel: 'openai/gpt-4o-mini',
    defaultCron: null,
    group: 'system',
  },
}

// Module-level singleton — survives across requests within same Next.js server process
declare global {
  // eslint-disable-next-line no-var
  var __agentProcesses: Map<string, {
    process: ChildProcess
    startedAt: Date
    lines: string[]
    exitCode: number | null
  }> | undefined
}

export const agentProcesses: Map<string, {
  process: ChildProcess
  startedAt: Date
  lines: string[]
  exitCode: number | null
}> = global.__agentProcesses ?? (global.__agentProcesses = new Map())
