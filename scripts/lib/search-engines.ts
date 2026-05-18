/**
 * Multi-engine discovery: Google News RSS, Bing News RSS, Hacker News Algolia, Reddit JSON.
 */
import { parseStringPromise } from "xml2js";

export type DateConfidence = "EXTRACTED" | "INFERRED" | "UNKNOWN";

export type DiscoveryEngine = "google_news" | "bing_news" | "hackernews" | "reddit";

export interface DiscoveryStub {
  url: string;
  title: string;
  publishedAt?: Date;
  dateConfidence: DateConfidence;
  publisher?: string;
  snippet?: string;
  engine: DiscoveryEngine;
}

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { headers: HEADERS, signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Build Google News RSS search URL */
export function buildGoogleNewsRssUrl(query: string): string {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en&gl=US&ceid=US:en`;
}

export function buildGoogleNewsWebUrl(query: string): string {
  return `https://news.google.com/search?q=${encodeURIComponent(query)}&hl=en&gl=US&ceid=US:en`;
}

export function buildBingNewsRssUrl(query: string): string {
  return `https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=rss`;
}

async function parseRssDiscovery(
  rssUrl: string,
  limit: number,
  engine: DiscoveryEngine,
): Promise<DiscoveryStub[]> {
  try {
    const res = await fetchWithTimeout(rssUrl, 12_000);
    if (!res.ok) return [];

    const xml = await res.text();
    const parsed = await parseStringPromise(xml, { explicitArray: false });
    const items = parsed.feed?.entry ?? parsed.rss?.channel?.item ?? [];
    const itemArr = (Array.isArray(items) ? items : [items]).filter(Boolean).slice(0, limit);

    const isGoogleNews = rssUrl.includes("news.google.com");
    const stubs: DiscoveryStub[] = [];

    for (const item of itemArr) {
      const rawUrl: string = item.link?.href ?? item.link ?? "";
      const guid: string = typeof item.guid === "object" ? item.guid._ ?? "" : item.guid ?? "";
      const url =
        isGoogleNews && guid ? `https://news.google.com/rss/articles/${guid}` : rawUrl.trim();
      if (!url) continue;

      const title: string = typeof item.title === "object" ? item.title._ ?? "" : item.title ?? "";
      if (!title) continue;

      const pubStr: string | undefined = item.pubDate ?? item.published ?? item.updated;
      let publishedAt: Date | undefined;
      let dateConfidence: DateConfidence = "UNKNOWN";
      if (pubStr) {
        const d = new Date(pubStr);
        if (!isNaN(d.getTime())) {
          publishedAt = d;
          dateConfidence = "EXTRACTED";
        }
      }

      const sourceEl = item.source;
      const publisher: string | undefined =
        typeof sourceEl === "string" ? sourceEl : sourceEl?._ ?? sourceEl?.__text;

      const descRaw: string = typeof item.description === "string" ? item.description : "";
      const snippet = descRaw ? stripHtml(descRaw).slice(0, 800) : "";

      stubs.push({
        url,
        title: stripHtml(title).trim(),
        publishedAt,
        dateConfidence,
        publisher,
        snippet,
        engine,
      });
    }
    return stubs;
  } catch {
    return [];
  }
}

export async function searchGoogleNews(query: string, limit: number): Promise<DiscoveryStub[]> {
  return parseRssDiscovery(buildGoogleNewsRssUrl(query), limit, "google_news");
}

export async function searchBingNews(query: string, limit: number): Promise<DiscoveryStub[]> {
  return parseRssDiscovery(buildBingNewsRssUrl(query), limit, "bing_news");
}

interface HnHit {
  url?: string;
  title?: string;
  created_at?: string;
}

export async function searchHackerNews(query: string, limit: number): Promise<DiscoveryStub[]> {
  try {
    const u = new URL("https://hn.algolia.com/api/v1/search");
    u.searchParams.set("query", query);
    u.searchParams.set("tags", "story");
    u.searchParams.set("hitsPerPage", String(Math.min(limit, 30)));

    const res = await fetchWithTimeout(u.toString(), 12_000);
    if (!res.ok) return [];

    const data = (await res.json()) as { hits?: HnHit[] };
    const hits = data.hits ?? [];
    const stubs: DiscoveryStub[] = [];

    for (const h of hits.slice(0, limit)) {
      const url = h.url?.trim();
      if (!url || !/^https?:\/\//i.test(url)) continue;
      const title = (h.title ?? "").trim();
      if (!title) continue;

      let publishedAt: Date | undefined;
      let dateConfidence: DateConfidence = "UNKNOWN";
      if (h.created_at) {
        const d = new Date(h.created_at);
        if (!isNaN(d.getTime())) {
          publishedAt = d;
          dateConfidence = "EXTRACTED";
        }
      }

      stubs.push({
        url,
        title,
        publishedAt,
        dateConfidence,
        publisher: "Hacker News",
        engine: "hackernews",
      });
    }
    return stubs;
  } catch {
    return [];
  }
}

interface RedditChild {
  data?: {
    url?: string;
    title?: string;
    selftext?: string;
    created_utc?: number;
    subreddit?: string;
  };
}

export async function searchReddit(query: string, limit: number): Promise<DiscoveryStub[]> {
  try {
    const u = new URL("https://www.reddit.com/search.json");
    u.searchParams.set("q", query);
    u.searchParams.set("sort", "new");
    u.searchParams.set("limit", String(Math.min(limit, 25)));

    const res = await fetchWithTimeout(u.toString(), 15_000);
    if (!res.ok) return [];

    const data = (await res.json()) as { data?: { children?: RedditChild[] } };
    const children = data.data?.children ?? [];
    const stubs: DiscoveryStub[] = [];

    for (const c of children.slice(0, limit)) {
      const d = c.data;
      if (!d?.title) continue;

      let url = (d.url ?? "").trim();
      if (url.startsWith("/")) url = `https://www.reddit.com${url}`;
      if (!url || !/^https?:\/\//i.test(url)) continue;

      const title = d.title.trim();
      const snippet = (d.selftext ?? "").slice(0, 500);

      let publishedAt: Date | undefined;
      let dateConfidence: DateConfidence = "UNKNOWN";
      if (typeof d.created_utc === "number") {
        publishedAt = new Date(d.created_utc * 1000);
        dateConfidence = "EXTRACTED";
      }

      stubs.push({
        url,
        title,
        publishedAt,
        dateConfidence,
        publisher: d.subreddit ? `r/${d.subreddit}` : "Reddit",
        snippet,
        engine: "reddit",
      });
    }
    return stubs;
  } catch {
    return [];
  }
}

/** Run all four engines in parallel */
export async function discoverForQuery(query: string, limitPerEngine: number): Promise<DiscoveryStub[]> {
  const cap = Math.max(1, Math.min(limitPerEngine, 25));
  const [gn, bn, hn, rd] = await Promise.all([
    searchGoogleNews(query, cap),
    searchBingNews(query, cap),
    searchHackerNews(query, cap),
    searchReddit(query, cap),
  ]);
  return [...gn, ...bn, ...hn, ...rd];
}
