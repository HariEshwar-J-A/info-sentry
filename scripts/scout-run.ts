#!/usr/bin/env tsx
/**
 * scout-run.ts v2 — Topic-driven parallel article discovery.
 *
 * Architecture:
 *   Phase 1 (PRIMARY)     — Google News RSS per interest, parallel (5 concurrent)
 *                           Works even when InterestSource table is empty.
 *   Phase 2 (SUPPLEMENT)  — Manually linked non-Google sources, parallel (3 concurrent)
 *
 * Google News RSS gives fresh, dated, topic-relevant articles for any topic.
 * Manual sources add domain-specific depth (e.g. TechCrunch for AI, IRCC for immigration).
 *
 * Env vars:
 *   MAX_ARTICLE_AGE_DAYS  (default: 3)  — skip articles older than this
 *   HISTORICAL_MODE=true               — disable age filter
 *   MAX_PER_TOPIC         (default: 10) — max articles per Google News search
 *   ARTICLES_DIR                        — raw article storage path
 */
import "dotenv/config";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { parseStringPromise } from "xml2js";
import { load } from "cheerio";
import { getScoutDb, disconnectAll } from "./lib/prisma.js";

// ─── Config ────────────────────────────────────────────────

const ARTICLES_DIR = process.env["ARTICLES_DIR"] ?? "./data/articles";
const MAX_PER_TOPIC = parseInt(process.env["MAX_PER_TOPIC"] ?? "10", 10);
const MAX_PER_SOURCE = 8;
const MAX_ARTICLE_AGE_DAYS = parseInt(process.env["MAX_ARTICLE_AGE_DAYS"] ?? "3", 10);
const HISTORICAL_MODE = process.env["HISTORICAL_MODE"] === "true";
const PHASE1_CONCURRENCY = 5;  // parallel Google News searches
const PHASE2_CONCURRENCY = 3;  // parallel manual source scrapes
const CRAWL_TIMEOUT_MS = 15_000;

// ─── Types ─────────────────────────────────────────────────

type DateConfidence = "EXTRACTED" | "INFERRED" | "UNKNOWN";

interface ArticleData {
  url: string;
  title: string;
  content: string;
  publishedAt?: Date;
  dateConfidence: DateConfidence;
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

function isArticleTooOld(publishedAt: Date | undefined, confidence: DateConfidence): boolean {
  if (HISTORICAL_MODE) return false;
  if (!publishedAt || confidence === "UNKNOWN") return false;
  const ageDays = (Date.now() - publishedAt.getTime()) / 86_400_000;
  return ageDays > MAX_ARTICLE_AGE_DAYS;
}

/** Build Google News RSS URL for a topic — combines name + top keywords */
function buildGoogleNewsUrl(topic: string, keywords: string[], description?: string | null): string {
  // Start with topic, add up to 3 unique keywords that aren't already in the topic
  const topicLower = topic.toLowerCase();
  const extra = keywords
    .filter((k) => !topicLower.includes(k.toLowerCase()))
    .slice(0, 3);

  const queryParts = [topic, ...extra];
  // If description adds meaningful context, use the first 3 words
  if (description) {
    const descWords = description.split(/\s+/).slice(0, 3).join(" ");
    queryParts.push(descWords);
  }

  const query = encodeURIComponent(queryParts.join(" "));
  return `https://news.google.com/rss/search?q=${query}&hl=en&gl=US&ceid=US:en`;
}

/** Get or create a Google News Source record for a topic, returns source id */
async function getOrCreateGoogleNewsSource(
  db: ReturnType<typeof getScoutDb>,
  topic: string,
  rssUrl: string,
): Promise<string> {
  const webUrl = `https://news.google.com/search?q=${encodeURIComponent(topic)}&hl=en&gl=US&ceid=US:en`;
  const name = `Google News: ${topic}`;

  const existing = await db.source.findFirst({ where: { rssUrl } });
  if (existing) return existing.id;

  // Also check by name in case rssUrl changed slightly
  const byName = await db.source.findFirst({ where: { name } });
  if (byName) {
    await db.source.update({ where: { id: byName.id }, data: { rssUrl } });
    return byName.id;
  }

  const created = await db.source.create({
    data: { name, url: webUrl, rssUrl, isActive: true, trustScore: 0.7 },
  });
  return created.id;
}

// ─── Date extraction ───────────────────────────────────────

function extractDateFromHtml(html: string, url: string): { publishedAt?: Date; dateConfidence: DateConfidence } {
  const $ = load(html);

  // 1. OG / meta tags
  for (const attr of ["article:published_time", "article:modified_time", "date", "pubdate", "DC.date"]) {
    const val = $(`meta[property="${attr}"], meta[name="${attr}"]`).attr("content");
    if (val) {
      const d = new Date(val);
      if (!isNaN(d.getTime())) return { publishedAt: d, dateConfidence: "EXTRACTED" };
    }
  }

  // 2. JSON-LD
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
    } catch { /* skip malformed */ }
  });
  if (jsonLdDate) return { publishedAt: jsonLdDate, dateConfidence: "EXTRACTED" };

  // 3. <time datetime> elements
  const timeEl = $("time[datetime]").first();
  if (timeEl.length) {
    const val = timeEl.attr("datetime");
    if (val) {
      const d = new Date(val);
      if (!isNaN(d.getTime())) return { publishedAt: d, dateConfidence: "EXTRACTED" };
    }
  }

  // 4. URL path date pattern /2025/05/03/
  const urlMatch = url.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
  if (urlMatch) {
    const d = new Date(`${urlMatch[1]}-${urlMatch[2]}-${urlMatch[3]}`);
    if (!isNaN(d.getTime())) return { publishedAt: d, dateConfidence: "INFERRED" };
  }

  return { dateConfidence: "UNKNOWN" };
}

// ─── Article text extraction ───────────────────────────────

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
      if (text.length > 300) return text.slice(0, 6000);
    }
  }

  return $("body").text().replace(/\s+/g, " ").trim().slice(0, 6000);
}

// ─── Save article to DB + disk ─────────────────────────────

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

  const ageHours = data.publishedAt
    ? (Date.now() - data.publishedAt.getTime()) / 3_600_000
    : null;

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
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
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

/** Crawl a URL, follow redirects, return article data using the canonical final URL */
async function crawlArticle(url: string): Promise<ArticleData | null> {
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return null;

    const canonicalUrl = res.url || url; // final URL after redirect chain
    const html = await res.text();
    const $ = load(html);

    const title = (
      $("meta[property='og:title']").attr("content") ||
      $("h1").first().text() ||
      $("title").text() ||
      "Untitled"
    ).trim().replace(/\s+/g, " ").slice(0, 200);

    const content = extractArticleText(html);
    if (content.length < 150) return null;

    const { publishedAt, dateConfidence } = extractDateFromHtml(html, canonicalUrl);

    return { url: canonicalUrl, title, content, publishedAt, dateConfidence };
  } catch {
    return null;
  }
}

/** Parse an RSS/Atom feed, return article stubs with metadata */
async function parseRssFeed(rssUrl: string, limit = MAX_PER_TOPIC): Promise<ArticleData[]> {
  try {
    const res = await fetchWithTimeout(rssUrl, 10_000);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const xml = await res.text();
    const parsed = await parseStringPromise(xml, { explicitArray: false });
    const items = parsed.feed?.entry ?? parsed.rss?.channel?.item ?? [];
    const itemArr = (Array.isArray(items) ? items : [items]).filter(Boolean).slice(0, limit);

    const articles: ArticleData[] = [];
    for (const item of itemArr) {
      const rawUrl: string = item.link?.href ?? item.link ?? "";
      const title: string = typeof item.title === "object" ? item.title._ ?? "" : item.title ?? "";
      if (!rawUrl || !title) continue;

      const pubStr: string | undefined = item.pubDate ?? item.published ?? item.updated;
      let publishedAt: Date | undefined;
      let dateConfidence: DateConfidence = "UNKNOWN";
      if (pubStr) {
        const d = new Date(pubStr);
        if (!isNaN(d.getTime())) { publishedAt = d; dateConfidence = "EXTRACTED"; }
      }

      if (isArticleTooOld(publishedAt, dateConfidence)) {
        const ageDays = publishedAt ? ((Date.now() - publishedAt.getTime()) / 86_400_000).toFixed(1) : "?";
        console.log(`[scout]   skip old (${ageDays}d): ${title.replace(/<[^>]+>/g, "").slice(0, 60)}`);
        continue;
      }

      articles.push({
        url: rawUrl.trim(),
        title: title.replace(/<[^>]+>/g, "").trim(),
        content: "",
        publishedAt,
        dateConfidence,
      });
    }
    return articles;
  } catch (err) {
    console.error(`[scout]   RSS error: ${(err as Error).message}`);
    return [];
  }
}

/** Find article links from a listing page (HTML scraping fallback) */
async function findArticleLinks(listingUrl: string): Promise<string[]> {
  try {
    const res = await fetchWithTimeout(listingUrl, 12_000);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const $ = load(await res.text());
    const links = new Set<string>();

    const selectors = [
      "article a[href]", "[class*='article'] a[href]", "[class*='post'] a[href]",
      "[class*='story'] a[href]", "h1 a[href]", "h2 a[href]", "h3 a[href]",
      ".title a[href]", "a[href*='/news/']", "a[href*='/articles/']",
      "a[href*='/2025/']", "a[href*='/2026/']",
    ];

    for (const sel of selectors) {
      $(sel).each((_, el) => {
        const href = $(el).attr("href");
        if (!href) return;
        const full = href.startsWith("http") ? href : new URL(href, listingUrl).toString();
        if (
          !full.match(/\.(pdf|jpg|png|gif|zip|svg)$/i) &&
          !full.includes("/tag/") && !full.includes("/category/") && !full.includes("/author/") &&
          full.length > listingUrl.length
        ) links.add(full);
      });
    }

    return [...links].slice(0, MAX_PER_SOURCE);
  } catch (err) {
    console.error(`[scout]   link scan error on ${listingUrl}: ${(err as Error).message}`);
    return [];
  }
}

// ─── Phase 1: Google News RSS per interest ─────────────────

async function scrapeGoogleNews(
  db: ReturnType<typeof getScoutDb>,
  interest: { id: string; topic: string; description: string | null; searchKeywords: string[] },
  globalSeen: Set<string>,
): Promise<number> {
  const rssUrl = buildGoogleNewsUrl(interest.topic, interest.searchKeywords, interest.description);
  const sourceId = await getOrCreateGoogleNewsSource(db, interest.topic, rssUrl);

  // Ensure this source is linked to the interest (fixes Sources (0) display for old interests)
  await db.interestSource.upsert({
    where: { interestId_sourceId: { interestId: interest.id, sourceId } },
    update: {},
    create: { interestId: interest.id, sourceId },
  }).catch(() => {});

  const stubs = await parseRssFeed(rssUrl, MAX_PER_TOPIC);
  if (stubs.length === 0) return 0;

  console.log(`[scout] [${interest.topic}] Google News: ${stubs.length} candidates`);

  let saved = 0;
  for (const stub of stubs) {
    // Crawl article → follow any redirect → get canonical URL + content
    const article = await crawlArticle(stub.url);
    if (!article) continue;

    // Use canonical URL for deduplication
    if (globalSeen.has(article.url)) continue;
    globalSeen.add(article.url);

    // Post-crawl age check with actual page date
    if (isArticleTooOld(article.publishedAt, article.dateConfidence)) {
      const ageDays = article.publishedAt
        ? ((Date.now() - article.publishedAt.getTime()) / 86_400_000).toFixed(1)
        : "?";
      console.log(`[scout]   skip old (${ageDays}d): ${article.title.slice(0, 60)}`);
      continue;
    }

    // Merge RSS date if crawled page has no date
    if (!article.publishedAt && stub.publishedAt) {
      article.publishedAt = stub.publishedAt;
      article.dateConfidence = stub.dateConfidence;
    }

    const ok = await saveRawArticle(db, {
      sourceId,
      url: article.url,
      title: article.title || stub.title,
      rawContent: article.content,
      publishedAt: article.publishedAt,
      dateConfidence: article.dateConfidence,
    });

    if (ok) {
      saved++;
      const age = article.publishedAt
        ? `${((Date.now() - article.publishedAt.getTime()) / 3_600_000).toFixed(0)}h`
        : "?";
      console.log(`[scout]   ✓ [${age}] ${article.title.slice(0, 70)}`);
    }
  }

  return saved;
}

// ─── Phase 2: Manual source scraping ──────────────────────

async function scrapeManualSource(
  db: ReturnType<typeof getScoutDb>,
  source: { id: string; name: string; url: string; rssUrl: string | null },
  globalSeen: Set<string>,
): Promise<number> {
  console.log(`[scout] [manual] ${source.name}`);

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
    if (globalSeen.has(stub.url)) continue;

    const existing = await db.article.findUnique({ where: { url: stub.url }, select: { id: true } });
    if (existing) { globalSeen.add(stub.url); continue; }

    if (isArticleTooOld(stub.publishedAt, stub.dateConfidence)) continue;

    const article = await crawlArticle(stub.url);
    if (!article) continue;

    if (globalSeen.has(article.url)) continue;
    globalSeen.add(article.url);

    if (isArticleTooOld(article.publishedAt, article.dateConfidence)) {
      const ageDays = article.publishedAt
        ? ((Date.now() - article.publishedAt.getTime()) / 86_400_000).toFixed(1) : "?";
      console.log(`[scout]   skip old (${ageDays}d): ${article.title.slice(0, 60)}`);
      continue;
    }

    if (!article.publishedAt && stub.publishedAt) {
      article.publishedAt = stub.publishedAt;
      article.dateConfidence = stub.dateConfidence;
    }

    const ok = await saveRawArticle(db, {
      sourceId: source.id,
      url: article.url,
      title: article.title || stub.title,
      rawContent: article.content,
      publishedAt: article.publishedAt,
      dateConfidence: article.dateConfidence,
    });

    if (ok) {
      saved++;
      const age = article.publishedAt
        ? `${((Date.now() - article.publishedAt.getTime()) / 3_600_000).toFixed(0)}h` : "?";
      console.log(`[scout]   ✓ [${age}] ${article.title.slice(0, 70)}`);
    }
  }

  return saved;
}

// ─── Main ──────────────────────────────────────────────────

async function main(): Promise<void> {
  const db = getScoutDb();
  const globalSeen = new Set<string>(); // cross-phase URL dedup

  console.log(`[scout] ═══════════════════════════════════════`);
  console.log(`[scout] Scout v2 — topic-driven parallel scraper`);
  console.log(`[scout] Mode: ${HISTORICAL_MODE ? "HISTORICAL" : `RECENT ≤${MAX_ARTICLE_AGE_DAYS}d`}  concurrency: ${PHASE1_CONCURRENCY}+${PHASE2_CONCURRENCY}`);
  console.log(`[scout] ═══════════════════════════════════════\n`);

  const interests = await db.interest.findMany({
    where: { isActive: true },
    select: { id: true, topic: true, description: true, searchKeywords: true },
    orderBy: { score: "desc" },
  });

  console.log(`[scout] ${interests.length} active interests\n`);

  // ── Phase 1: Google News RSS per topic (parallel) ────────
  console.log(`[scout] ── Phase 1: Google News RSS (${PHASE1_CONCURRENCY} concurrent) ──\n`);
  let phase1Total = 0;

  await pLimit(interests, PHASE1_CONCURRENCY, async (interest) => {
    try {
      const n = await scrapeGoogleNews(db, interest, globalSeen);
      phase1Total += n;
      if (n > 0) console.log(`[scout] [${interest.topic}] → ${n} articles saved\n`);
    } catch (err) {
      console.error(`[scout] [${interest.topic}] ERROR: ${(err as Error).message}`);
    }
  });

  console.log(`\n[scout] Phase 1 done: ${phase1Total} articles from Google News\n`);

  // ── Phase 2: Manual sources (parallel, skip Google News) ──
  const junctions = await db.interestSource.findMany({
    where: { interest: { isActive: true } },
    include: {
      source: { select: { id: true, name: true, url: true, rssUrl: true, isActive: true } },
    },
  });

  // Deduplicate by sourceId, skip Google News (already covered in Phase 1)
  const seenSourceIds = new Set<string>();
  const manualSources = junctions
    .map((j) => j.source)
    .filter((s): s is NonNullable<typeof s> => {
      if (!s || !s.isActive) return false;
      if (seenSourceIds.has(s.id)) return false;
      if (s.name.startsWith("Google News:")) return false; // covered in Phase 1
      seenSourceIds.add(s.id);
      return true;
    });

  if (manualSources.length > 0) {
    console.log(`[scout] ── Phase 2: ${manualSources.length} manual sources (${PHASE2_CONCURRENCY} concurrent) ──\n`);
    let phase2Total = 0;

    await pLimit(manualSources, PHASE2_CONCURRENCY, async (source) => {
      try {
        const n = await scrapeManualSource(db, source, globalSeen);
        phase2Total += n;
        if (n > 0) console.log(`[scout] [manual:${source.name}] → ${n} articles saved\n`);
      } catch (err) {
        console.error(`[scout] [manual:${source.name}] ERROR: ${(err as Error).message}`);
      }
    });

    console.log(`\n[scout] Phase 2 done: ${phase2Total} articles from manual sources\n`);
  } else {
    console.log(`[scout] Phase 2: no manual sources to scrape\n`);
  }

  await db.agentConfig.upsert({
    where: { agentName: "scout" },
    update: { lastRunAt: new Date(), lastError: null },
    create: { agentName: "scout", lastRunAt: new Date() },
  }).catch(() => {});

  console.log(`[scout] ═══════════════════════════════════════`);
  console.log(`[scout] Complete`);
  console.log(`[scout] ═══════════════════════════════════════`);
  await disconnectAll();
}

main().catch((err) => {
  console.error("[scout] Fatal:", err);
  process.exit(1);
});
