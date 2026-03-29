import OpenAI from "openai";

function getApiKey(): string {
  const key = process.env["OPENROUTER_API_KEY"];
  if (!key) throw new Error("OPENROUTER_API_KEY not set");
  return key;
}

let _openai: OpenAI | undefined;

export function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({
      apiKey: getApiKey(),
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": "https://github.com/info-sentry",
        "X-Title": "Info-Sentry",
      },
    });
  }
  return _openai;
}

// ─── LLM Response Type ──────────────────────────────────────

export interface LLMResponse {
  content: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  generationId: string | undefined;
}

// ─── Chat Completion Wrapper ────────────────────────────────

export async function chatCompletion(
  modelId: string,
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  options?: {
    temperature?: number;
    maxTokens?: number;
    responseFormat?: { type: "json_object" | "text" };
  },
): Promise<LLMResponse> {
  const openai = getOpenAI();

  const response = await openai.chat.completions.create({
    model: modelId,
    messages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 2048,
    response_format: options?.responseFormat,
  });

  const choice = response.choices[0];
  if (!choice?.message?.content) {
    throw new Error("Empty response from OpenRouter");
  }

  return {
    content: choice.message.content,
    promptTokens: response.usage?.prompt_tokens ?? 0,
    completionTokens: response.usage?.completion_tokens ?? 0,
    totalTokens: response.usage?.total_tokens ?? 0,
    generationId: response.id,
  };
}

// ─── API Key Usage Info (for budget monitoring) ─────────────

interface KeyInfoResponse {
  data?: {
    usage?: number;
    limit?: number | null;
    rate_limit?: {
      remaining?: number;
    };
  };
}

export async function getKeyInfo(): Promise<{
  usage: number;
  limit: number | null;
  rateLimitRemaining: number;
}> {
  const res = await fetch("https://openrouter.ai/api/v1/auth/key", {
    headers: { Authorization: `Bearer ${getApiKey()}` },
  });

  if (!res.ok) {
    throw new Error(`OpenRouter key info request failed: ${res.status}`);
  }

  const data = (await res.json()) as KeyInfoResponse;

  return {
    usage: data.data?.usage ?? 0,
    limit: data.data?.limit ?? null,
    rateLimitRemaining: data.data?.rate_limit?.remaining ?? 0,
  };
}
