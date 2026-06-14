import { prisma } from '@/lib/prisma'

// Per-million token costs for the chat model (OpenRouter pricing)
// Update if model changes in openrouter.ts
const PROMPT_COST_PER_1M  = 0.10  // USD — Gemini 2.0 Flash input
const COMPL_COST_PER_1M   = 0.40  // USD — Gemini 2.0 Flash output

interface ChatUsage {
  promptTokens:     number
  completionTokens: number
}

/**
 * Log a web-chat AI call to CostLog, associated with a user.
 * Fire-and-forget — errors are caught and logged, never rethrown.
 */
export async function logChatCost(
  userId: string,
  model: string,
  usage: ChatUsage
): Promise<void> {
  try {
    const cost =
      (usage.promptTokens     / 1_000_000) * PROMPT_COST_PER_1M +
      (usage.completionTokens / 1_000_000) * COMPL_COST_PER_1M

    await prisma.costLog.create({
      data: {
        agentName:        'web-chat',
        modelId:          model,
        promptTokens:     usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalCostUsd:     cost,
        userId,
      },
    })
  } catch (err) {
    console.error('[cost-logger] failed to log chat cost:', err)
  }
}
