/**
 * Typed HTTP client for the ScrapeGraphAI Python sidecar (FastAPI).
 */
import { setTimeout as delay } from "node:timers/promises";

const SCRAPEGRAPH_URL = (process.env["SCRAPEGRAPH_URL"] ?? "http://127.0.0.1:8811").replace(/\/$/, "");

export interface SmartScrapeResult {
  title?: string;
  author?: string | null;
  published_at?: string | null;
  publishedAt?: string | null;
  content?: string;
  summary?: string;
  raw?: unknown;
  [key: string]: unknown;
}

export interface SearchScrapeResult {
  answer?: string;
  considered_urls?: string[];
  [key: string]: unknown;
}

async function postJson<T>(
  path: string,
  body: unknown,
  timeoutMs: number,
): Promise<T> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${SCRAPEGRAPH_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`ScrapeGraph ${path}: HTTP ${res.status} — ${text.slice(0, 300)}`);
    }
    return JSON.parse(text) as T;
  } finally {
    clearTimeout(id);
  }
}

/** Normalize SmartScraperGraph dict / accidental JSON-in-string fields */
export function normalizeSmartResult(raw: Record<string, unknown>): SmartScrapeResult {
  const out: SmartScrapeResult = { ...raw };

  for (const key of ["content", "title", "summary", "author", "published_at", "publishedAt"]) {
    const v = out[key];
    if (typeof v === "string" && (v.trim().startsWith("{") || v.trim().startsWith("["))) {
      try {
        const parsed = JSON.parse(v) as Record<string, unknown>;
        Object.assign(out, parsed);
      } catch {
        /* keep string */
      }
    }
  }

  return out;
}

export interface SmartScrapeOptions {
  prompt?: string;
  timeoutMs?: number;
  retries?: number;
}

/**
 * LLM-assisted scrape for a single URL via SmartScraperGraph.
 */
export async function smartScrape(url: string, opts?: SmartScrapeOptions): Promise<SmartScrapeResult> {
  const timeoutMs = opts?.timeoutMs ?? parseInt(process.env["SGAI_TIMEOUT_MS"] ?? "120000", 10);
  const retries = opts?.retries ?? parseInt(process.env["SGAI_RETRIES"] ?? "2", 10);

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const raw = await postJson<Record<string, unknown>>(
        "/smart-scrape",
        { url, prompt: opts?.prompt },
        timeoutMs,
      );
      return normalizeSmartResult(raw);
    } catch (e) {
      lastErr = e;
      if (attempt < retries) await delay(400 * (attempt + 1));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export async function searchScrapeViaSidecar(
  topic: string,
  prompt: string,
  maxResults: number,
  opts?: { timeoutMs?: number; retries?: number },
): Promise<SearchScrapeResult> {
  const timeoutMs = opts?.timeoutMs ?? parseInt(process.env["SGAI_SEARCH_TIMEOUT_MS"] ?? "180000", 10);
  const retries = opts?.retries ?? 1;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await postJson<SearchScrapeResult>(
        "/search-scrape",
        { topic, prompt, max_results: maxResults },
        timeoutMs,
      );
    } catch (e) {
      lastErr = e;
      if (attempt < retries) await delay(600 * (attempt + 1));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export async function followRedirectsSidecar(
  url: string,
  opts?: { timeoutMs?: number },
): Promise<string | null> {
  const timeoutMs = opts?.timeoutMs ?? parseInt(process.env["SGAI_FOLLOW_TIMEOUT_MS"] ?? "60000", 10);
  try {
    const res = await postJson<{ url: string }>("/follow-redirects", { url }, timeoutMs);
    return res.url ?? null;
  } catch {
    return null;
  }
}
