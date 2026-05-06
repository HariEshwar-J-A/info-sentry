/**
 * Budget defaults for Scout v3 — query expansion (Node) + SmartScraper (Python sidecar via SGAI_MODEL in compose/.env).
 * Override with QUERY_EXPAND_MODEL / SGAI_MODEL on OpenRouter.
 */

/** Budget Scout default — valid on OpenRouter, cheap, strong for extraction/search helpers. */
export const SCOUT_DEFAULT_OPENROUTER_MODEL = "google/gemini-2.0-flash-001";

export function getQueryExpandModel(): string {
  const v = process.env["QUERY_EXPAND_MODEL"]?.trim();
  return v || SCOUT_DEFAULT_OPENROUTER_MODEL;
}

/** Hint for logs / health (SGAI runs inside Docker; model comes from compose env). */
export function getSgaiModelHint(): string {
  const v = process.env["SGAI_MODEL"]?.trim();
  return v || SCOUT_DEFAULT_OPENROUTER_MODEL;
}
