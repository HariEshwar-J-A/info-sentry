import { ChildProcess } from 'child_process'
import path from 'path'

// Absolute path to the repo root (web/ is process.cwd())
export const REPO_ROOT = path.resolve(process.cwd(), '..')

// Model options shown in settings
export const AVAILABLE_MODELS = [
  { id: 'moonshotai/kimi-k2.6',             name: 'Kimi K2.6',        tier: 'Premium', desc: 'Best chain-of-thought reasoning' },
  { id: 'deepseek/deepseek-v3.2',            name: 'DeepSeek V3.2',    tier: 'Balanced', desc: 'Smart, fast, cost-effective' },
  { id: 'deepseek/deepseek-r1',              name: 'DeepSeek R1',       tier: 'Premium', desc: 'Deep analysis with reasoning traces' },
  { id: 'google/gemini-2.0-flash-001',       name: 'Gemini 2.0 Flash', tier: 'Balanced', desc: '1M context, fast, cheap' },
  { id: 'google/gemini-3.1-flash-lite',      name: 'Gemini 3.1 Lite',  tier: 'Budget', desc: 'Ultra-fast, very cheap' },
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
}> = {
  scout: {
    label: 'Scout',
    description: 'Scrapes news sources every 30min for fresh articles',
    icon: '🔍',
    script: 'scripts/scout-run.ts',
    defaultModel: 'google/gemini-3.1-flash-lite',
  },
  analyst: {
    label: 'Analyst',
    description: 'Analyzes SCRAPED articles → creates summaries + embeddings → posts to Telegram Main-News → marks SUMMARIZED',
    icon: '🧠',
    script: 'scripts/analyst-run.ts',
    defaultModel: 'deepseek/deepseek-v3.2',
  },
  prediction: {
    label: 'Predictor',
    description: 'Generates predictions from SUMMARIZED articles → posts to Telegram Predictions → marks POSTED',
    icon: '🎯',
    script: 'scripts/predictor-run.ts',
    defaultModel: 'moonshotai/kimi-k2.6',
  },
  'prediction-verifier': {
    label: 'Prediction Verifier',
    description: 'Checks tracked predictions against recent news using kimi-k2.6 chain-of-thought + DuckDuckGo',
    icon: '🔮',
    script: 'scripts/prediction-verifier.ts',
    defaultModel: 'moonshotai/kimi-k2.6',
  },
  feedback: {
    label: 'Feedback',
    description: 'Processes Telegram callback signals and updates interest scores (event-driven)',
    icon: '💬',
    script: null,
    defaultModel: 'openai/gpt-4o-mini',
  },
  manager: {
    label: 'Manager',
    description: 'System health, budget monitoring and Telegram DM commands (event-driven)',
    icon: '📊',
    script: 'scripts/health-check.ts',
    defaultModel: 'openai/gpt-4o-mini',
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
