export interface ModelConfig {
  readonly id: string;
  readonly name: string;
  readonly promptCostPer1M: number;
  readonly completionCostPer1M: number;
}

export const MODELS = {
  ANALYST: {
    id: "deepseek/deepseek-v3.2",
    name: "DeepSeek V3.2",
    promptCostPer1M: 0.25,
    completionCostPer1M: 0.38,
  },
  PREDICTION: {
    id: "deepseek/deepseek-v3.2",
    name: "DeepSeek V3.2",
    promptCostPer1M: 0.25,
    completionCostPer1M: 0.38,
  },
  FEEDBACK: {
    id: "google/gemini-3.1-flash-lite",
    name: "Gemini 3.1 Flash Lite",
    promptCostPer1M: 0.25,
    completionCostPer1M: 2.0,
  },
  MANAGER: {
    id: "google/gemini-3.1-flash-lite",
    name: "Gemini 3.1 Flash Lite",
    promptCostPer1M: 0.25,
    completionCostPer1M: 2.0,
  },
} as const satisfies Record<string, ModelConfig>;

export function estimateCost(
  model: ModelConfig,
  promptTokens: number,
  completionTokens: number,
): number {
  return (
    (promptTokens / 1_000_000) * model.promptCostPer1M +
    (completionTokens / 1_000_000) * model.completionCostPer1M
  );
}
