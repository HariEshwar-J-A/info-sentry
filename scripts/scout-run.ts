#!/usr/bin/env tsx
/**
 * scout-run.ts v3 — Multi-engine discovery + ScrapeGraphAI sidecar extraction.
 *
 * Phase 1: LLM query expansion → Google News / Bing News / HN / Reddit discovery →
 *          resolve Google News redirects → fast Cheerio fetch → SmartScraperGraph fallback.
 * Phase 2: Manual linked sources (RSS + listing), same SGAI fallback.
 *
 * Env:
 *   SCRAPEGRAPH_URL (default http://127.0.0.1:8811)
 *   SGAI_MAX_CALLS_PER_RUN (default 30)
 *   SGAI_MIN_CONTENT_LEN (default 400)
 *   MAX_PER_TOPIC (default 12)
 *   MAX_ARTICLE_AGE_DAYS / HISTORICAL_MODE — unchanged
 */
import "dotenv/config";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { parseStringPromise } from "xml2js";
import { load } from "cheerio";
import { getScoutDb, disconnectAll } from "./lib/prisma.js";
import { parseInterestIdArg } from "./lib/args.js";
import {
  discoverForQuery,
  buildGoogleNewsRssUrl,
  buildGoogleNewsWebUrl,
  type DiscoveryStub,
} from "./lib/search-engines.js";
import { resolvePublisherUrl } from "./lib/google-news-resolver.js";
import { expandQueries } from "./lib/query-expand.js";
import { smartScrape, searchScrapeViaSidecar, type SmartScrapeResult } from "./lib/scrapegraph.js";
import { getQueryExpandModel, getSgaiModelHint } from "./lib/scout-llm-defaults.js";
import {
  buildInterestSearchQuery,
  buildSmartScrapePromptForInterests,
  buildSearchGraphTopicAndPrompt,
  dedupeInterestFocuses,
  type InterestFocus,
} from "./lib/scout-interest-focus.js";

// ─── Config ────────────────────────────────────────────────

const ARTICLES_DIR = process.env["ARTICLES_DIR"] ?? "./data/articles";
const MAX_PER_TOPIC = parseInt(process.env["MAX_PER_TOPIC"] ?? "12", 10);
const MAX_PER_SOURCE = 8;
const MAX_ARTICLE_AGE_DAYS = parseInt(process.env["MAX_ARTICLE_AGE_DAYS"] ?? "3", 10);
const HISTORICAL_MODE = process.env["HISTORICAL_MODE"] === "true";
const PHASE1_CONCURRENCY = 3;
const PHASE2_CONCURRENCY = 3;
const CRAWL_TIMEOUT_MS = 15_000;
const SGAI_MAX_CALLS = parseInt(process.env["SGAI_MAX_CALLS_PER_RUN"] ?? "30", 10);
const SGAI_MIN_CONTENT = parseInt(process.env["SGAI_MIN_CONTENT_LEN"] ?? "400", 10);
const RESOLVE_CONCURRENCY = 4;
const ARTICLE_FETCH_CONCURRENCY = 2;
const SGAI_SEARCH_FALLBACK = process.env["SGAI_SEARCH_FALLBACK"] !== "false";

// ─── Types ─────────────────────────────────────────────────

type DateConfidence = "EXTRACTED" | "INFERRED" | "UNKNOWN";

interface ArticleData {
  url: string;
  title: string;
  content: string;
  publishedAt?: Date;
  dateConfidence: DateConfidence;
  publisher?: string;
  publisherUrl?: string;
  isRssOnly?: boolean;
}

class SgaiBudget {
  private _used = 0;
  constructor(readonly max: number) {}
  get used(): number {
    return this._used;
  }
  get remaining(): number {
    return Math.max(0, this.max - this._used);
  }
  recordCall(): void {
    this._used++;
  }
  canUse(): boolean {
    return this._used < this.max;
  }
}

async function probeScrapegraphSidecar(): Promise<boolean> {
  const base = (process.env["SCRAPEGRAPH_URL"] ?? "http://127.0.0.1:8811").replace(/\/$/, "");
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(`${base}/health`, { signal: ctrl.signal });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Concurrency ───────────────────────────────────────────

async function pLimit<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  const executing = new Set<Promise<void>>();
  for (const item of items) {
    const p: Promise<void> = fn(item).finally(() => executing.delete(p));
    executing.add(p);
    if (executing.size >= limit) await Promise.race(executing);
  }
  await Promise.all(executing);
}

// ─── Helpers ───────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizeDedupeKey(url: string): string {
  try {
    const u = new URL(url);
    for (const p of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid"]) {
      u.searchParams.delete(p);
    }
    u.hash = "";
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    let path = u.pathname.replace(/\/$/, "") || "/";
    return `${host}${path}${u.search}`;
  } catch {
    return url.toLowerCase();
  }
}

function stubScore(s: DiscoveryStub): number {
  let score = 0;
  if (s.dateConfidence === "EXTRACTED") score += 10;
  if (s.snippet && s.snippet.length > 120) score += 3;
  if (s.engine === "google_news") score += 2;
  if (s.engine === "bing_news") score += 1;
  return score;
}

function dedupeStubs(stubs: DiscoveryStub[]): DiscoveryStub[] {
  const map = new Map<string, DiscoveryStub>();
  for (const s of stubs) {
    const key = normalizeDedupeKey(s.url);
    const prev = map.get(key);
    if (!prev || stubScore(s) > stubScore(prev)) map.set(key, s);
  }
  return [...map.values()];
}

function isArticleTooOld(publishedAt: Date | undefined, confidence: DateConfidence): boolean {
  if (HISTORICAL_MODE) return false;
  if (!publishedAt || confidence === "UNKNOWN") return false;
  const ageDays = (Date.now() - publishedAt.getTime()) / 86_400_000;
  return ageDays > MAX_ARTICLE_AGE_DAYS;
}

async function getOrCreatePipelineSource(
  db: ReturnType<typeof getScoutDb>,
  topic: string,
  primarySearchQuery: string,
  rssUrl: string,
): Promise<string> {
  const webUrl = buildGoogleNewsWebUrl(primarySearchQuery);
  const name = `News pipeline: ${topic}`;

  const existing = await db.source.findFirst({ where: { rssUrl } });
  if (existing) return existing.id;

  const byName = await db.source.findFirst({ where: { name } });
  if (byName) {
    await db.source.update({ where: { id: byName.id }, data: { rssUrl } });
    return byName.id;
  }

  const created = await db.source.create({
    data: { name, url: webUrl, rssUrl, isActive: true, trustScore: 0.75 },
  });
  return created.id;
}

// ─── Date extraction ───────────────────────────────────────

function extractDateFromHtml(html: string, url: string): { publishedAt?: Date; dateConfidence: DateConfidence } {
  const $ = load(html);

  for (const attr of ["article:published_time", "article:modified_time", "date", "pubdate", "DC.date"]) {
    const val = $(`meta[property="${attr}"], meta[name="${attr}"]`).attr("content");
    if (val) {
      const d = new Date(val);
      if (!isNaN(d.getTime())) return { publishedAt: d, dateConfidence: "EXTRACTED" };
    }
  }

  let jsonLdDate: Date | undefined;
  $('script[type="application/ld+json"]').each((_, el) => {
    if (jsonLdDate) return;
    try {
      const obj = JSON.parse($(el).text()) as Record<string, unknown>;
      const ds = (obj.datePublished ?? obj.dateModified ?? obj.uploadDate) as string | undefined;
      if (ds) {
        const d = new Date(ds);
        if (!isNaN(d.getTime())) jsonLdDate = d;
      }
    } catch {
      /* skip */
    }
  });
  if (jsonLdDate) return { publishedAt: jsonLdDate, dateConfidence: "EXTRACTED" };

  const timeEl = $("time[datetime]").first();
  if (timeEl.length) {
    const val = timeEl.attr("datetime");
    if (val) {
      const d = new Date(val);
      if (!isNaN(d.getTime())) return { publishedAt: d, dateConfidence: "EXTRACTED" };
    }
  }

  const urlMatch = url.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
  if (urlMatch) {
    const d = new Date(`${urlMatch[1]}-${urlMatch[2]}-${urlMatch[3]}`);
    if (!isNaN(d.getTime())) return { publishedAt: d, dateConfidence: "INFERRED" };
  }

  return { dateConfidence: "UNKNOWN" };
}

function extractArticleText(html: string): string {
  const $ = load(html);
  $("script, style, nav, header, footer, aside, iframe, noscript, [class*='ad-'], [class*='banner']").remove();

  const candidates = [
    "article",
    "main",
    '[role="main"]',
    ".article-body",
    ".post-content",
    ".entry-content",
    ".story-body",
    ".article-content",
    '[class*="article-body"]',
    '[class*="post-body"]',
  ];

  for (const sel of candidates) {
    const el = $(sel).first();
    if (el.length) {
      const text = el.text().replace(/\s+/g, " ").trim();
      if (text.length > 300) return text.slice(0, 8000);
    }
  }

  return $("body").text().replace(/\s+/g, " ").trim().slice(0, 8000);
}

// ─── Save article ──────────────────────────────────────────

async function saveRawArticle(
  db: ReturnType<typeof getScoutDb>,
  data: {
    sourceId: string;
    url: string;
    title: string;
    rawContent: string;
    publishedAt?: Date;
    dateConfidence: DateConfidence;
  },
): Promise<boolean> {
  const existing = await db.article.findUnique({ where: { url: data.url }, select: { id: true } });
  if (existing) return false;

  await mkdir(ARTICLES_DIR, { recursive: true });
  const filename = `${data.sourceId}_${Date.now()}_${slugify(data.title)}.md`;
  const frontmatter = [
    "---",
    `title: ${data.title.replace(/:/g, " -")}`,
    `url: ${data.url}`,
    data.publishedAt ? `publishedAt: ${data.publishedAt.toISOString()}` : "publishedAt: unknown",
    `dateConfidence: ${data.dateConfidence}`,
    `scrapedAt: ${new Date().toISOString()}`,
    "---",
    "",
  ].join("\n");

  await writeFile(join(ARTICLES_DIR, filename), frontmatter + data.rawContent, "utf-8");

  const ageHours = data.publishedAt ? (Date.now() - data.publishedAt.getTime()) / 3_600_000 : null;

  await db.article.create({
    data: {
      sourceId: data.sourceId,
      url: data.url,
      title: data.title,
      rawFilePath: join(ARTICLES_DIR, filename),
      status: "SCRAPED",
      publishedAt: data.publishedAt ?? null,
      dateConfidence: data.dateConfidence,
      ageHours,
    },
  });

  return true;
}

// ─── Fetch helpers ─────────────────────────────────────────

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

async function fetchWithTimeout(url: string, ms = CRAWL_TIMEOUT_MS): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { headers: HEADERS, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function crawlArticle(url: string): Promise<ArticleData | null> {
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return null;

    const canonicalUrl = res.url || url;
    const html = await res.text();
    const $ = load(html);

    const title = (
      $("meta[property='og:title']").attr("content") ||
      $("h1").first().text() ||
      $("title").text() ||
      "Untitled"
    )
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 200);

    const content = extractArticleText(html);
    if (content.length < 150) return null;

    const { publishedAt, dateConfidence } = extractDateFromHtml(html, canonicalUrl);

    return { url: canonicalUrl, title, content, publishedAt, dateConfidence };
  } catch {
    return null;
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

function mergeSmartIntoArticle(stub: DiscoveryStub, smart: SmartScrapeResult, url: string): ArticleData {
  const title = (typeof smart.title === "string" && smart.title.trim()) ? smart.title.trim().slice(0, 200) : stub.title;
  let content = typeof smart.content === "string" ? smart.content.trim() : "";
  if (smart.summary && typeof smart.summary === "string" && content.length < 250) {
    content = `${content}\n\nSummary: ${smart.summary}`.trim();
  }

  let publishedAt = stub.publishedAt;
  let dateConfidence: DateConfidence = stub.dateConfidence;
  const paRaw = smart.published_at ?? smart.publishedAt;
  if (typeof paRaw === "string" && paRaw.trim()) {
    const d = new Date(paRaw.trim());
    if (!isNaN(d.getTime())) {
      publishedAt = d;
      dateConfidence = "EXTRACTED";
    }
  }

  return {
    url,
    title,
    content,
    publishedAt,
    dateConfidence,
    publisher: stub.publisher,
  };
}

function snippetFallback(stub: DiscoveryStub): string {
  const parts = [`Title: ${stub.title}`];
  if (stub.publisher) parts.push(`Source: ${stub.publisher}`);
  if (stub.snippet) parts.push(stub.snippet);
  return parts.join("\n\n");
}

async function parseRssFeed(rssUrl: string, limit = MAX_PER_TOPIC): Promise<ArticleData[]> {
  try {
    const res = await fetchWithTimeout(rssUrl, 10_000);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const xml = await res.text();
    const parsed = await parseStringPromise(xml, { explicitArray: false });
    const items = parsed.feed?.entry ?? parsed.rss?.channel?.item ?? [];
    const itemArr = (Array.isArray(items) ? items : [items]).filter(Boolean).slice(0, limit);

    const isGoogleNews = rssUrl.includes("news.google.com");
    const articles: ArticleData[] = [];

    for (const item of itemArr) {
      const rawUrl: string = item.link?.href ?? item.link ?? "";
      const guid: string = typeof item.guid === "object" ? item.guid._ ?? "" : item.guid ?? "";
      const url = isGoogleNews && guid ? `https://news.google.com/rss/articles/${guid}` : rawUrl.trim();
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

      if (isArticleTooOld(publishedAt, dateConfidence)) continue;

      const sourceEl = item.source;
      const publisherUrl: string | undefined = sourceEl?.$?.url ?? sourceEl?.url;
      const publisher: string | undefined =
        typeof sourceEl === "string" ? sourceEl : sourceEl?._ ?? sourceEl?.__text;

      const descRaw: string = typeof item.description === "string" ? item.description : "";
      const descText = descRaw ? stripHtml(descRaw).slice(0, 500) : "";

      const content = isGoogleNews
        ? [`Title: ${stripHtml(title)}`, publisher ? `Publisher: ${publisher}` : "", descText].filter(Boolean).join("\n")
        : descText;

      articles.push({
        url,
        title: stripHtml(title).trim(),
        content,
        publishedAt,
        dateConfidence,
        publisher,
        publisherUrl,
        isRssOnly: isGoogleNews,
      });
    }
    return articles;
  } catch (err) {
    console.error(`[scout]   RSS error: ${(err as Error).message}`);
    return [];
  }
}

async function findArticleLinks(listingUrl: string): Promise<string[]> {
  try {
    const res = await fetchWithTimeout(listingUrl, 12_000);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const $ = load(await res.text());
    const links = new Set<string>();

    const selectors = [
      "article a[href]",
      "[class*='article'] a[href]",
      "[class*='post'] a[href]",
      "[class*='story'] a[href]",
      "h1 a[href]",
      "h2 a[href]",
      "h3 a[href]",
      ".title a[href]",
      "a[href*='/news/']",
      "a[href*='/articles/']",
      "a[href*='/2025/']",
      "a[href*='/2026/']",
    ];

    for (const sel of selectors) {
      $(sel).each((_, el) => {
        const href = $(el).attr("href");
        if (!href) return;
        const full = href.startsWith("http") ? href : new URL(href, listingUrl).toString();
        if (
          !full.match(/\.(pdf|jpg|png|gif|zip|svg)$/i) &&
          !full.includes("/tag/") &&
          !full.includes("/category/") &&
          !full.includes("/author/") &&
          full.length > listingUrl.length
        )
          links.add(full);
      });
    }

    return [...links].slice(0, MAX_PER_SOURCE);
  } catch (err) {
    console.error(`[scout]   link scan error on ${listingUrl}: ${(err as Error).message}`);
    return [];
  }
}

// ─── Phase 1 ───────────────────────────────────────────────

async function ingestArticleFromStub(
  db: ReturnType<typeof getScoutDb>,
  sourceId: string,
  stub: DiscoveryStub,
  resolvedUrl: string,
  globalSeen: Set<string>,
  sgai: SgaiBudget,
  sidecarOk: boolean,
  smartScrapePrompt?: string,
): Promise<boolean> {
  if (globalSeen.has(resolvedUrl)) return false;

  const existing = await db.article.findUnique({ where: { url: resolvedUrl }, select: { id: true } });
  if (existing) {
    globalSeen.add(resolvedUrl);
    return false;
  }

  if (isArticleTooOld(stub.publishedAt, stub.dateConfidence)) return false;

  let article = await crawlArticle(resolvedUrl);
  const urlForSgai = article?.url ?? resolvedUrl;

  if ((!article || article.content.length < SGAI_MIN_CONTENT) && sidecarOk && sgai.canUse()) {
    sgai.recordCall();
    try {
      const smart = await smartScrape(urlForSgai, { prompt: smartScrapePrompt });
      const merged = mergeSmartIntoArticle(stub, smart, urlForSgai);
      if (merged.content.length >= 80) {
        article = merged;
      }
    } catch (err) {
      console.warn(`[scout]   SGAI scrape failed: ${(err as Error).message}`);
    }
  }

  if (!article || article.content.length < 80) {
    const fb = snippetFallback(stub);
    if (fb.length < 40) return false;

    const ok = await saveRawArticle(db, {
      sourceId,
      url: resolvedUrl,
      title: stub.title,
      rawContent: fb,
      publishedAt: stub.publishedAt,
      dateConfidence: stub.dateConfidence,
    });
    if (ok) {
      globalSeen.add(resolvedUrl);
      console.log(`[scout]   ✓ [snippet-only] ${stub.title.slice(0, 70)} (${stub.engine})`);
    }
    return ok;
  }

  const canonical = article.url;
  if (globalSeen.has(canonical)) return false;

  const dupCanon = await db.article.findUnique({ where: { url: canonical }, select: { id: true } });
  if (dupCanon) {
    globalSeen.add(canonical);
    return false;
  }

  globalSeen.add(canonical);

  let pub = article.publishedAt ?? stub.publishedAt;
  let conf = article.dateConfidence;
  if (!pub && stub.publishedAt) {
    pub = stub.publishedAt;
    conf = stub.dateConfidence;
  }

  if (isArticleTooOld(pub, conf)) return false;

  const raw =
    article.publisher || stub.publisher
      ? `${article.content}\n\n---\nSource: ${stub.publisher ?? article.publisher}`
      : article.content;

  const ok = await saveRawArticle(db, {
    sourceId,
    url: article.url,
    title: article.title || stub.title,
    rawContent: raw,
    publishedAt: pub,
    dateConfidence: conf,
  });

  if (ok) {
    const age = pub ? `${((Date.now() - pub.getTime()) / 3_600_000).toFixed(0)}h` : "?";
    console.log(`[scout]   ✓ [${age}] ${(article.title || stub.title).slice(0, 70)} (${stub.engine})`);
  }

  return ok;
}

async function scrapeTopicPipeline(
  db: ReturnType<typeof getScoutDb>,
  interest: InterestFocus & { id: string },
  globalSeen: Set<string>,
  sgai: SgaiBudget,
  sidecarOk: boolean,
): Promise<number> {
  const primaryQuery = buildInterestSearchQuery(interest);
  const phase1SmartPrompt = buildSmartScrapePromptForInterests([interest]);
  const rssUrl = buildGoogleNewsRssUrl(primaryQuery);
  const sourceId = await getOrCreatePipelineSource(db, interest.topic, primaryQuery, rssUrl);

  await db.interestSource
    .upsert({
      where: { interestId_sourceId: { interestId: interest.id, sourceId } },
      update: {},
      create: { interestId: interest.id, sourceId },
    })
    .catch(() => {});

  const queries = await expandQueries(interest);
  console.log(`[scout] [${interest.topic}] queries: ${queries.join(" | ")}`);

  const limitPerEngine = Math.max(3, Math.ceil(MAX_PER_TOPIC / queries.length) + 2);
  let stubs: DiscoveryStub[] = [];

  for (const q of queries) {
    const batch = await discoverForQuery(q, limitPerEngine);
    stubs.push(...batch);
  }

  await pLimit(stubs, RESOLVE_CONCURRENCY, async (stub) => {
    stub.url = await resolvePublisherUrl(stub.url);
  });

  stubs = dedupeStubs(stubs);

  if (stubs.length < 6 && sidecarOk && SGAI_SEARCH_FALLBACK && sgai.canUse()) {
    sgai.recordCall();
    try {
      const { topic: sgTopic, prompt: sgPrompt } = buildSearchGraphTopicAndPrompt(interest);
      const sg = await searchScrapeViaSidecar(sgTopic, sgPrompt, Math.min(6, MAX_PER_TOPIC));
      const urls = sg.considered_urls ?? [];
      for (const u of urls) {
        if (typeof u !== "string" || !/^https?:\/\//i.test(u)) continue;
        stubs.push({
          url: u,
          title: interest.topic,
          dateConfidence: "UNKNOWN",
          engine: "hackernews",
        });
      }
      stubs = dedupeStubs(stubs);
      console.log(`[scout] [${interest.topic}] SearchGraph fallback: +${urls.length} URLs considered`);
    } catch (err) {
      console.warn(`[scout] SearchGraph fallback failed: ${(err as Error).message}`);
    }
  }

  stubs = stubs.filter((s) => !isArticleTooOld(s.publishedAt, s.dateConfidence));

  stubs.sort((a, b) => {
    const ta = a.publishedAt?.getTime() ?? 0;
    const tb = b.publishedAt?.getTime() ?? 0;
    return tb - ta;
  });

  stubs = stubs.slice(0, MAX_PER_TOPIC);

  console.log(`[scout] [${interest.topic}] ${stubs.length} candidates after dedupe/sort`);

  let saved = 0;
  await pLimit(stubs, ARTICLE_FETCH_CONCURRENCY, async (stub) => {
    const url = stub.url;
    try {
      const ok = await ingestArticleFromStub(
        db,
        sourceId,
        stub,
        url,
        globalSeen,
        sgai,
        sidecarOk,
        phase1SmartPrompt,
      );
      if (ok) saved++;
    } catch (err) {
      console.error(`[scout]   ingest error: ${(err as Error).message}`);
    }
  });

  return saved;
}

// ─── Phase 2 ───────────────────────────────────────────────

async function scrapeManualSource(
  db: ReturnType<typeof getScoutDb>,
  source: { id: string; name: string; url: string; rssUrl: string | null },
  globalSeen: Set<string>,
  sgai: SgaiBudget,
  sidecarOk: boolean,
  interestFocuses?: InterestFocus[],
): Promise<number> {
  const focusHint =
    interestFocuses?.length ?
      ` (${interestFocuses.map((f) => f.topic).join(", ")})`
    : "";
  console.log(`[scout] [manual] ${source.name}${focusHint}`);

  const smartPrompt =
    interestFocuses && interestFocuses.length > 0 ?
      buildSmartScrapePromptForInterests(dedupeInterestFocuses(interestFocuses))
    : undefined;

  const stubs: ArticleData[] = [];

  if (source.rssUrl) {
    const rssItems = await parseRssFeed(source.rssUrl, MAX_PER_SOURCE);
    stubs.push(...rssItems);
    console.log(`[scout]   RSS: ${rssItems.length} items`);
  }

  if (stubs.length < MAX_PER_SOURCE) {
    const links = await findArticleLinks(source.url);
    for (const link of links) {
      if (!stubs.find((s) => s.url === link)) {
        stubs.push({ url: link, title: "", content: "", dateConfidence: "UNKNOWN" });
      }
    }
    console.log(`[scout]   HTML links: ${links.length}`);
  }

  let saved = 0;
  for (const stub of stubs.slice(0, MAX_PER_SOURCE)) {
    let targetUrl = stub.url;
    if (stub.isRssOnly && stub.url.includes("news.google.com")) {
      targetUrl = await resolvePublisherUrl(stub.url);
    }

    if (globalSeen.has(targetUrl)) continue;

    const existing = await db.article.findUnique({ where: { url: targetUrl }, select: { id: true } });
    if (existing) {
      globalSeen.add(targetUrl);
      continue;
    }

    if (isArticleTooOld(stub.publishedAt, stub.dateConfidence)) continue;

    let crawled = await crawlArticle(targetUrl);

    if ((!crawled || crawled.content.length < SGAI_MIN_CONTENT) && sidecarOk && sgai.canUse()) {
      sgai.recordCall();
      try {
        const smart = await smartScrape(targetUrl, { prompt: smartPrompt });
        const fakeDiscovery: DiscoveryStub = {
          url: targetUrl,
          title: stub.title || "Untitled",
          publishedAt: stub.publishedAt,
          dateConfidence: stub.dateConfidence,
          publisher: stub.publisher,
          snippet: stub.content,
          engine: "bing_news",
        };
        const merged = mergeSmartIntoArticle(fakeDiscovery, smart, targetUrl);
        if (merged.content.length >= 80) crawled = merged;
      } catch {
        /* fall through */
      }
    }

    const finalUrl = crawled?.url ?? targetUrl;
    const finalTitle = crawled?.title || stub.title;
    const finalContent =
      crawled && crawled.content.length >= 80
        ? crawled.content
        : stub.content && stub.content.length >= 30
          ? `${stub.title}\n\n${stub.content}`
          : null;

    if (!finalContent) continue;

    if (globalSeen.has(finalUrl)) continue;
    globalSeen.add(finalUrl);

    const finalDate = crawled?.publishedAt ?? stub.publishedAt;
    const finalConf = crawled?.dateConfidence ?? stub.dateConfidence;

    if (isArticleTooOld(finalDate, finalConf)) continue;

    const ok = await saveRawArticle(db, {
      sourceId: source.id,
      url: finalUrl,
      title: finalTitle,
      rawContent: finalContent,
      publishedAt: finalDate,
      dateConfidence: finalConf,
    });

    if (ok) {
      saved++;
      const age = finalDate ? `${((Date.now() - finalDate.getTime()) / 3_600_000).toFixed(0)}h` : "?";
      const mode =
        crawled && crawled.content.length >= SGAI_MIN_CONTENT ? "" : crawled?.content ? " [thin]" : " [rss]";
      console.log(`[scout]   ✓ [${age}]${mode} ${finalTitle.slice(0, 70)}`);
    }
  }

  return saved;
}

// ─── Main ──────────────────────────────────────────────────

async function main(): Promise<void> {
  const db = getScoutDb();
  const globalSeen = new Set<string>();
  const interestId = parseInterestIdArg();
  const sgaiGlobal = new SgaiBudget(SGAI_MAX_CALLS);

  const sgSidecarOk = await probeScrapegraphSidecar();
  const sgUrl = (process.env["SCRAPEGRAPH_URL"] ?? "http://127.0.0.1:8811").replace(/\/$/, "");

  console.log(`[scout] ═══════════════════════════════════════`);
  console.log(`[scout] Scout v3 — ScrapeGraphAI multi-source pipeline`);
  console.log(
    `[scout] Mode: ${HISTORICAL_MODE ? "HISTORICAL" : `RECENT ≤${MAX_ARTICLE_AGE_DAYS}d`}  SGAI budget: ${SGAI_MAX_CALLS}/run`,
  );
  console.log(
    `[scout] Sidecar ${sgUrl}: ${sgSidecarOk ? "healthy" : "unreachable — LLM scrape disabled until scrapegraph is up (Cheerio + snippets only)"}`,
  );
  console.log(
    `[scout] OpenRouter models — query-expand: ${getQueryExpandModel()} | SGAI (.env for compose): ${getSgaiModelHint()}`,
  );
  console.log(`[scout] ═══════════════════════════════════════\n`);

  const interests = await db.interest.findMany({
    where: { isActive: true, ...(interestId ? { id: interestId } : {}) },
    select: { id: true, topic: true, description: true, searchKeywords: true },
    orderBy: { score: "desc" },
  });

  console.log(`[scout] ${interests.length} active interests\n`);

  console.log(`[scout] ── Phase 1: topic pipeline (${PHASE1_CONCURRENCY} concurrent) ──\n`);
  let phase1Total = 0;

  await pLimit(interests, PHASE1_CONCURRENCY, async (interest) => {
    try {
      const n = await scrapeTopicPipeline(db, interest, globalSeen, sgaiGlobal, sgSidecarOk);
      phase1Total += n;
      if (n > 0) console.log(`[scout] [${interest.topic}] → ${n} articles saved\n`);
    } catch (err) {
      console.error(`[scout] [${interest.topic}] ERROR: ${(err as Error).message}`);
    }
  });

  console.log(`\n[scout] Phase 1 done: ${phase1Total} articles (SGAI calls used: ${sgaiGlobal.used})\n`);

  const junctions = await db.interestSource.findMany({
    where: { interest: { isActive: true, ...(interestId ? { id: interestId } : {}) } },
    include: {
      interest: { select: { topic: true, description: true, searchKeywords: true } },
      source: { select: { id: true, name: true, url: true, rssUrl: true, isActive: true } },
    },
  });

  const manualBySource = new Map<
    string,
    {
      source: { id: string; name: string; url: string; rssUrl: string | null };
      focuses: InterestFocus[];
    }
  >();

  for (const j of junctions) {
    const s = j.source;
    if (!s?.isActive) continue;
    if (s.name.startsWith("News pipeline:") || s.name.startsWith("Google News:")) continue;

    let row = manualBySource.get(s.id);
    if (!row) {
      row = { source: s, focuses: [] };
      manualBySource.set(s.id, row);
    }
    row.focuses.push({
      topic: j.interest.topic,
      description: j.interest.description,
      searchKeywords: j.interest.searchKeywords,
    });
  }

  const manualRuns = [...manualBySource.values()];

  if (manualRuns.length > 0) {
    console.log(`[scout] ── Phase 2: ${manualRuns.length} manual sources (${PHASE2_CONCURRENCY} concurrent) ──\n`);
    let phase2Total = 0;

    await pLimit(manualRuns, PHASE2_CONCURRENCY, async ({ source, focuses }) => {
      try {
        const n = await scrapeManualSource(db, source, globalSeen, sgaiGlobal, sgSidecarOk, focuses);
        phase2Total += n;
        if (n > 0) console.log(`[scout] [manual:${source.name}] → ${n} articles saved\n`);
      } catch (err) {
        console.error(`[scout] [manual:${source.name}] ERROR: ${(err as Error).message}`);
      }
    });

    console.log(`\n[scout] Phase 2 done: ${phase2Total} articles\n`);
  } else {
    console.log(`[scout] Phase 2: no manual sources to scrape\n`);
  }

  console.log(`[scout] Total SGAI sidecar calls: ${sgaiGlobal.used} / ${SGAI_MAX_CALLS}`);

  await db.agentConfig
    .upsert({
      where: { agentName: "scout" },
      update: { lastRunAt: new Date(), lastError: null },
      create: { agentName: "scout", lastRunAt: new Date() },
    })
    .catch(() => {});

  console.log(`[scout] ═══════════════════════════════════════`);
  console.log(`[scout] Complete`);
  console.log(`[scout] ═══════════════════════════════════════`);
  await disconnectAll();
}

main().catch((err) => {
  console.error("[scout] Fatal:", err);
  process.exit(1);
});
