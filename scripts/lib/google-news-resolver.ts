/**
 * Resolve Google News wrapper URLs to publisher article URLs where possible.
 */
import { followRedirectsSidecar } from "./scrapegraph.js";

/** Decode protobuf-wrapped token used in news.google.com/rss/articles/{token} */
export function decodeGoogleNewsArticleUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("news.google.com")) return null;

    const parts = u.pathname.split("/").filter(Boolean);
    const idx = parts.indexOf("articles");
    if (idx === -1 || !parts[idx + 1]) return null;

    let token = parts[idx + 1]!;
    token = token.replace(/-/g, "+").replace(/_/g, "/");
    while (token.length % 4 !== 0) token += "=";

    const buf = Buffer.from(token, "base64");
    const latin = buf.toString("latin1");

    const matches = [...latin.matchAll(/https?:\/\/[^\s\x00-\x1f"'<>\\]+/g)];
    if (matches.length === 0) return null;

    let best: string | null = null;
    for (const m of matches) {
      let candidate = m[0];
      candidate = candidate.replace(/\\u003d/gi, "=").replace(/\\u0026/gi, "&");
      candidate = candidate.replace(/[,;.)\]'"]+$/, "");
      try {
        const parsed = new URL(candidate);
        if (!parsed.hostname.includes("google.")) best = candidate;
      } catch {
        /* skip */
      }
    }
    return best;
  } catch {
    return null;
  }
}

export async function resolvePublisherUrl(url: string): Promise<string> {
  if (!url.includes("news.google.com")) return url;

  const decoded = decodeGoogleNewsArticleUrl(url);
  if (decoded) return decoded;

  const followed = await followRedirectsSidecar(url);
  if (followed && !followed.includes("news.google.com")) return followed;

  return url;
}
