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

/** Raised spending caps must be changed at OpenRouter (not in-code). */
export const OPENROUTER_KEY_SETTINGS_URL = "https://openrouter.ai/settings/keys";

// ─── LLM Response Type ──────────────────────────────────────

export interface LLMResponse {
  content: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  generationId: string | undefined;
  /** OpenRouter model id that produced this response (after any rate-limit fallbacks). */
  modelUsed: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function httpErrorStatus(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const s = (err as { status?: number }).status;
  return typeof s === "number" ? s : undefined;
}

function retryAfterMsFromError(err: unknown): number | null {
  if (httpErrorStatus(err) !== 429) return null;
  const h = (err as { headers?: { get?: (n: string) => string | null } }).headers;
  if (!h?.get) return null;
  const raw = h.get("retry-after") ?? h.get("Retry-After");
  if (!raw) return null;
  const sec = parseInt(raw, 10);
  if (!Number.isFinite(sec) || sec < 1) return null;
  return Math.min(sec * 1000, 120_000);
}

function defaultRateLimitFallbackModels(): string[] {
  const raw = process.env["OPENROUTER_RATE_LIMIT_FALLBACK_MODELS"]?.trim();
  if (raw)
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  return ["openai/gpt-4o-mini", "deepseek/deepseek-v3.2"];
}

function stringifyExecLikeError(err: unknown): string {
  if (err == null) return "";
  if (typeof err === "string") return err;
  if (typeof err !== "object") return String(err);
  const e = err as Record<string, unknown>;
  return [String(e.message ?? ""), bufferToString(e.stderr), bufferToString(e.stdout)].join("\n");
}

function bufferToString(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(v)) return v.toString("utf8");
  return String(v);
}

/** True when OpenRouter rejects because the key's total spending limit was reached (HTTP 403). */
export function isOpenRouterKeyLimitExceeded(err: unknown): boolean {
  const blob = stringifyExecLikeError(err);
  return (
    blob.includes("Key limit exceeded") ||
    blob.includes("key limit exceeded") ||
    blob.includes("OPENROUTER_KEY_LIMIT")
  );
}

async function executeChatCompletion(
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
    const reason = choice?.finish_reason ?? "unknown";
    throw new Error(`Empty response from OpenRouter (finish_reason=${reason}, model=${modelId})`);
  }

  return {
    content: choice.message.content,
    promptTokens: response.usage?.prompt_tokens ?? 0,
    completionTokens: response.usage?.completion_tokens ?? 0,
    totalTokens: response.usage?.total_tokens ?? 0,
    generationId: response.id,
    modelUsed: modelId,
  };
}

async function chatCompletionWithRetries(
  modelId: string,
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  options:
    | {
        temperature?: number;
        maxTokens?: number;
        responseFormat?: { type: "json_object" | "text" };
      }
    | undefined,
  maxAttempts: number,
): Promise<LLMResponse> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await executeChatCompletion(modelId, messages, options);
    } catch (err) {
      lastErr = err;
      if (isOpenRouterKeyLimitExceeded(err) || httpErrorStatus(err) === 403) throw err;
      if (httpErrorStatus(err) !== 429) throw err;
      if (attempt === maxAttempts - 1) throw err;
      const fromHeader = retryAfterMsFromError(err);
      const backoff = Math.min(
        45_000,
        fromHeader ?? Math.round(1800 * Math.pow(1.8, attempt) + Math.random() * 800),
      );
      console.warn(
        `[openrouter] ${modelId}: HTTP 429 — retry ${attempt + 2}/${maxAttempts} in ${Math.round(backoff / 1000)}s`,
      );
      await sleep(backoff);
    }
  }
  throw lastErr;
}

// ─── Chat Completion Wrapper ────────────────────────────────

export async function chatCompletion(
  modelId: string,
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  options?: {
    temperature?: number;
    maxTokens?: number;
    responseFormat?: { type: "json_object" | "text" };
    /** If set, replaces env default fallbacks when primary model hits persistent 429s. */
    rateLimitFallbackModels?: string[];
  },
): Promise<LLMResponse> {
  const explicit = options?.rateLimitFallbackModels;
  const fallbacks = explicit !== undefined ? explicit : defaultRateLimitFallbackModels();
  const chain = [modelId, ...fallbacks.filter((m) => m && m !== modelId)];

  const primaryRetries = Math.max(1, parseInt(process.env["OPENROUTER_MAX_RETRIES_429"] ?? "5", 10));
  const fallbackRetries = Math.max(1, parseInt(process.env["OPENROUTER_FALLBACK_MAX_RETRIES_429"] ?? "3", 10));

  let lastErr: unknown;
  for (let i = 0; i < chain.length; i++) {
    const mid = chain[i]!;
    const retries = i === 0 ? primaryRetries : fallbackRetries;
    try {
      return await chatCompletionWithRetries(mid, messages, options, retries);
    } catch (err) {
      lastErr = err;
      if (isOpenRouterKeyLimitExceeded(err) || httpErrorStatus(err) === 403) throw err;
      if (httpErrorStatus(err) !== 429 || i === chain.length - 1) throw err;
      console.warn(`[openrouter] ${mid}: still rate limited — trying fallback ${chain[i + 1]}`);
    }
  }
  throw lastErr;
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

/** analyst-process exits with code 2 when the key limit is hit so the parent can stop the batch. */
export function isOpenRouterKeyLimitExitCode(err: unknown): boolean {
  const code = typeof err === "object" && err !== null ? (err as { code?: string | number }).code : undefined;
  return code === 2 || code === "2";
}

/** True for OpenRouter/upstream HTTP 429 (after retries caller may exit 3). */
export function isOpenRouterRateLimitError(err: unknown): boolean {
  if (httpErrorStatus(err) === 429) return true;
  const blob = stringifyExecLikeError(err).toLowerCase();
  return (
    blob.includes("ratelimiterror") ||
    blob.includes("rate limit") ||
    blob.includes("rate-limited") ||
    /\b429\b/.test(blob)
  );
}

/** analyst-process exits with code 3 when every model in the chain is rate limited. */
export function isOpenRouterRateLimitExitCode(err: unknown): boolean {
  const code = typeof err === "object" && err !== null ? (err as { code?: string | number }).code : undefined;
  return code === 3 || code === "3";
}

/** Pre-flight: skip analyst batches when usage already hit the OpenRouter key cap. */
export async function assertOpenRouterKeyHasHeadroom(): Promise<void> {
  const k = await getKeyInfo();
  if (k.limit == null) return;
  if (k.usage >= k.limit) {
    throw new Error(
      `OpenRouter key usage (${k.usage}) reached key limit (${k.limit}). Raise/remove limit at ${OPENROUTER_KEY_SETTINGS_URL}`,
    );
  }
}
