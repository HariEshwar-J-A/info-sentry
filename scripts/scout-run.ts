#!/usr/bin/env tsx
/**
 * scout-run.ts — Date-aware crawler with age filtering and recency enforcement.
 *
 * Env vars:
 *   MAX_ARTICLE_AGE_DAYS  (default: 3)  — skip articles older than this
 *   HISTORICAL_MODE=true               — disable age filter, fetch all
 *   ARTICLES_DIR                        — storage path for raw article files
 */
import "dotenv/config";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { parseStringPromise } from "xml2js";
import { load } from "cheerio";
import { getScoutDb, disconnectAll } from "./lib/prisma.js";

const ARTICLES_DIR = process.env["ARTICLES_DIR"] ?? "./data/articles";
const MAX_ARTICLES_PER_SOURCE = 8;
const MAX_ARTICLE_AGE_DAYS = parseInt(process.env["MAX_ARTICLE_AGE_DAYS"] ?? "3", 10);
const HISTORICAL_MODE = process.env["HISTORICAL_MODE"] === "true";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

type DateConfidence = "EXTRACTED" | "INFERRED" | "UNKNOWN";

interface ArticleData {
  url: string;
  title: string;
  content: string;
  publishedAt?: Date;
  dateConfidence: DateConfidence;
}

function isArticleTooOld(publishedAt: Date | undefined, confidence: DateConfidence): boolean {
  if (HISTORICAL_MODE) return false;
  if (!publishedAt || confidence === "UNKNOWN") return false;
  const ageDays = (Date.now() - publishedAt.getTime()) / (1000 * 60 * 60 * 24);
  return ageDays > MAX_ARTICLE_AGE_DAYS;
}

function extractDateFromHtml(html: string, url: string): { publishedAt?: Date; dateConfidence: DateConfidence } {
  const $ = load(html);
  let publishedAt: Date | undefined;
  let dateConfidence: DateConfidence = "UNKNOWN";

  // Priority 1: Open Graph / meta tags
  const metaDate =
    $("meta[property='article:published_time']").attr("content") ||
    $("meta[property='og:article:published_time']").attr("content") ||
    $("meta[name='pubdate']").attr("content") ||
    $("meta[name='date']").attr("content") ||
    $("meta[name='DC.date']").attr("content") ||
    $("meta[itemprop='datePublished']").attr("content");

  if (metaDate) {
    const d = new Date(metaDate);
    if (!isNaN(d.getTime())) {
      publishedAt = d;
      dateConfidence = "EXTRACTED";
      return { publishedAt, dateConfidence };
    }
  }

  // Priority 2: JSON-LD structured data
  $("script[type='application/ld+json']").each((_, el) => {
    if (publishedAt) return;
    try {
      const raw = $(el).html() ?? "";
      const data = JSON.parse(raw) as Record<string, unknown>;
      const entries = Array.isArray(data) ? data : [data];
      for (const entry of entries) {
        const d = (entry as Record<string, string>)["datePublished"] ||
                  (entry as Record<string, string>)["dateCreated"] ||
                  (entry as Record<string, string>)["dateModified"];
        if (d) {
          const parsed = new Date(d);
          if (!isNaN(parsed.getTime())) {
            publishedAt = parsed;
            dateConfidence = "EXTRACTED";
            break;
          }
        }
      }
    } catch {}
  });
  if (publishedAt) return { publishedAt, dateConfidence };

  // Priority 3: <time> element
  const timeEl = $("time[datetime]").first().attr("datetime");
  if (timeEl) {
    const d = new Date(timeEl);
    if (!isNaN(d.getTime())) {
      publishedAt = d;
      dateConfidence = "INFERRED";
      return { publishedAt, dateConfidence };
    }
  }

  // Priority 4: URL path date pattern /2025/04/15/ or /2025-04-15/
  const urlDateMatch = url.match(/\/(\d{4})[\/\-](\d{1,2})(?:[\/\-](\d{1,2}))?/);
  if (urlDateMatch) {
    const year = parseInt(urlDateMatch[1]!);
    const month = parseInt(urlDateMatch[2]!);
    const day = parseInt(urlDateMatch[3] ?? "1");
    if (year >= 2020 && year <= 2030 && month >= 1 && month <= 12) {
      publishedAt = new Date(year, month - 1, day);
      dateConfidence = "INFERRED";
    }
  }

  return { publishedAt, dateConfidence };
}

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
): Promise<{ articleId: string; rawFilePath: string } | null> {
  const existing = await db.article.findUnique({
    where: { url: data.url },
    select: { id: true },
  });
  if (existing) return null;

  const timestamp = Date.now();
  const slug = slugify(data.title);
  const filename = `${data.sourceId}_${timestamp}_${slug}.md`;
  const filePath = join(ARTICLES_DIR, filename);

  // Prepend frontmatter with date metadata
  const frontmatter = [
    `---`,
    `title: ${data.title.replace(/:/g, " -")}`,
    `url: ${data.url}`,
    data.publishedAt ? `publishedAt: ${data.publishedAt.toISOString()}` : `publishedAt: unknown`,
    `dateConfidence: ${data.dateConfidence}`,
    `scrapedAt: ${new Date().toISOString()}`,
    `---`,
    ``,
  ].join("\n");

  await mkdir(ARTICLES_DIR, { recursive: true });
  await writeFile(filePath, frontmatter + data.rawContent, "utf-8");

  const ageHours = data.publishedAt
    ? (Date.now() - data.publishedAt.getTime()) / (1000 * 60 * 60)
    : null;

  const article = await db.article.create({
    data: {
      sourceId: data.sourceId,
      url: data.url,
      title: data.title,
      rawFilePath: filePath,
      status: "SCRAPED",
      publishedAt: data.publishedAt ?? null,
      dateConfidence: data.dateConfidence,
      ageHours,
    },
  });

  return { articleId: article.id, rawFilePath: filePath };
}

function extractArticleText(html: string, _url: string): string {
  const $ = load(html);

  $("nav, header, footer, aside, .sidebar, .ad, .advertisement, .comments").remove();
  $("script, style, noscript, iframe, .social-share, .newsletter, .related").remove();

  let content = $("article");
  if (!content.length) content = $("[role='main']");
  if (!content.length) content = $("main");
  if (!content.length) content = $(".content");
  if (!content.length) content = $(".post");
  if (!content.length) content = $(".entry");
  if (!content.length) content = $("#content");
  if (!content.length) content = $(".main");
  if (!content.length) content = $("body");

  const textParts: string[] = [];
  content.find("p, h1, h2, h3, h4, h5, h6, li").each((_, el) => {
    const text = $(el).text().trim();
    if (
      text.length > 40 &&
      !text.match(/^(click|read|share|follow|sign up|subscribe|advertisement|sponsored)/i)
    ) {
      textParts.push(text);
    }
  });

  return textParts.join("\n\n").slice(0, 15000);
}

async function parseRssFeed(rssUrl: string): Promise<ArticleData[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(rssUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; InfoSentry/1.0)" },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const xml = await response.text();
    const parsed = await parseStringPromise(xml, { explicitArray: false });

    const articles: ArticleData[] = [];
    const items = parsed.feed?.entry || parsed.rss?.channel?.item || [];
    const itemArray = Array.isArray(items) ? items.slice(0, MAX_ARTICLES_PER_SOURCE) : [items].filter(Boolean);

    for (const item of itemArray) {
      const url = item.link?.href || item.link || "";
      const title = item.title || "Untitled";
      const pubDateStr: string | undefined = item.pubDate || item.published || item.updated;

      if (url && title && typeof url === "string" && typeof title === "string") {
        let publishedAt: Date | undefined;
        let dateConfidence: DateConfidence = "UNKNOWN";

        if (pubDateStr) {
          const d = new Date(pubDateStr);
          if (!isNaN(d.getTime())) {
            publishedAt = d;
            dateConfidence = "EXTRACTED";
          }
        }

        // RSS age filter
        if (isArticleTooOld(publishedAt, dateConfidence)) {
          const ageDays = publishedAt
            ? ((Date.now() - publishedAt.getTime()) / (1000 * 60 * 60 * 24)).toFixed(1)
            : "?";
          console.log(`[scout]   Skipping old RSS item (${ageDays}d): ${(title as string).slice(0, 60)}`);
          continue;
        }

        articles.push({
          url: (url as string).trim(),
          title: (title as string).trim().replace(/<[^>]+>/g, ""),
          content: "",
          publishedAt,
          dateConfidence,
        });
      }
    }

    return articles;
  } catch (err) {
    console.error(`[scout] RSS parse failed for ${rssUrl}:`, err);
    return [];
  }
}

async function findArticleLinks(listingUrl: string): Promise<string[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const response = await fetch(listingUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; InfoSentry/1.0)" },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const html = await response.text();
    const $ = load(html);
    const links: string[] = [];

    const selectors = [
      "article a[href]",
      "[class*='article'] a[href]",
      "[class*='post'] a[href]",
      "[class*='story'] a[href]",
      "[class*='news'] a[href]",
      "h1 a[href]",
      "h2 a[href]",
      "h3 a[href]",
      ".title a[href]",
      "a[href*='/news/']",
      "a[href*='/articles/']",
      "a[href*='/post/']",
      "a[href*='/story/']",
      "a[href*='/2025/']",
      "a[href*='/2026/']",
    ];

    for (const sel of selectors) {
      $(sel).each((_, el) => {
        const href = $(el).attr("href");
        if (href) {
          const fullUrl = href.startsWith("http")
            ? href
            : new URL(href, listingUrl).toString();

          if (
            !fullUrl.match(/\.(pdf|jpg|png|gif|zip)$/i) &&
            !fullUrl.includes("/tag/") &&
            !fullUrl.includes("/category/") &&
            !fullUrl.includes("/author/") &&
            fullUrl.length > listingUrl.length
          ) {
            links.push(fullUrl);
          }
        }
      });
    }

    return [...new Set(links)].slice(0, MAX_ARTICLES_PER_SOURCE);
  } catch (err) {
    console.error(`[scout] Failed to find links on ${listingUrl}:`, err);
    return [];
  }
}

async function crawlArticle(url: string): Promise<ArticleData | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; InfoSentry/1.0)" },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) return null;

    const html = await response.text();
    const $ = load(html);

    const title =
      $("meta[property='og:title']").attr("content") ||
      $("h1").first().text() ||
      $("title").text() ||
      "Untitled";

    const content = extractArticleText(html, url);
    if (content.length < 200) return null;

    const { publishedAt, dateConfidence } = extractDateFromHtml(html, url);

    return {
      url,
      title: title.trim().replace(/\s+/g, " ").slice(0, 200),
      content,
      publishedAt,
      dateConfidence,
    };
  } catch (err) {
    console.error(`[scout] Failed to crawl ${url}:`, err);
    return null;
  }
}

async function scrapeSource(
  db: ReturnType<typeof getScoutDb>,
  source: { id: string; name: string; url: string; rssUrl: string | null },
): Promise<number> {
  console.log(`[scout] Processing: ${source.name}`);

  const articlesToFetch: ArticleData[] = [];

  // 1. RSS first (most reliable — includes dates)
  if (source.rssUrl) {
    const rssArticles = await parseRssFeed(source.rssUrl);
    articlesToFetch.push(...rssArticles);
    console.log(`[scout]   RSS found: ${rssArticles.length} recent articles`);
  }

  // 2. Page link scraping
  const links = await findArticleLinks(source.url);
  console.log(`[scout]   Page links found: ${links.length}`);

  for (const link of links) {
    if (!articlesToFetch.find((a) => a.url === link)) {
      articlesToFetch.push({ url: link, title: "", content: "", dateConfidence: "UNKNOWN" });
    }
  }

  // 3. Fetch, age-filter, and save
  let saved = 0;
  for (const article of articlesToFetch.slice(0, MAX_ARTICLES_PER_SOURCE)) {
    const existing = await db.article.findUnique({
      where: { url: article.url },
      select: { id: true },
    });
    if (existing) continue;

    // Quick age check from RSS date before crawling
    if (isArticleTooOld(article.publishedAt, article.dateConfidence)) {
      const ageDays = article.publishedAt
        ? ((Date.now() - article.publishedAt.getTime()) / (1000 * 60 * 60 * 24)).toFixed(1)
        : "?";
      console.log(`[scout]   Skipping old article (${ageDays}d): ${article.title.slice(0, 60) || article.url.slice(0, 60)}`);
      continue;
    }

    if (!article.content) {
      const fullArticle = await crawlArticle(article.url);
      if (!fullArticle) continue;
      Object.assign(article, fullArticle);
    }

    // Post-crawl age check (now we have the actual date from HTML)
    if (isArticleTooOld(article.publishedAt, article.dateConfidence)) {
      const ageDays = article.publishedAt
        ? ((Date.now() - article.publishedAt.getTime()) / (1000 * 60 * 60 * 24)).toFixed(1)
        : "?";
      console.log(`[scout]   Skipping old article (${ageDays}d): ${article.title.slice(0, 60)}`);
      continue;
    }

    const result = await saveRawArticle(db, {
      sourceId: source.id,
      url: article.url,
      title: article.title,
      rawContent: article.content,
      publishedAt: article.publishedAt,
      dateConfidence: article.dateConfidence,
    });

    if (result) {
      saved++;
      const age = article.publishedAt
        ? `${((Date.now() - article.publishedAt.getTime()) / (1000 * 60 * 60)).toFixed(0)}h ago`
        : "age unknown";
      console.log(`[scout]   ✓ [${age}] ${article.title.slice(0, 60)}`);
    }
  }

  return saved;
}

async function main(): Promise<void> {
  const db = getScoutDb();

  console.log(`[scout] Starting scout run`);
  console.log(`[scout] Mode: ${HISTORICAL_MODE ? "HISTORICAL (no age filter)" : `RECENT only (max ${MAX_ARTICLE_AGE_DAYS} days)`}\n`);

  const interests = await db.interest.findMany({
    where: { isActive: true },
    select: { id: true, topic: true, searchKeywords: true },
    orderBy: { score: "desc" },
  });

  console.log(`[scout] ${interests.length} active interests\n`);

  for (const interest of interests) {
    if (interest.searchKeywords.length > 0) {
      console.log(`[scout] Interest "${interest.topic}" — refined keywords: ${interest.searchKeywords.slice(0, 5).join(", ")}`);
    }
  }

  // Collect all unique active sources across all interests (deduplicate by id)
  const allJunctions = await db.interestSource.findMany({
    where: { interest: { isActive: true } },
    include: {
      source: {
        select: { id: true, name: true, url: true, rssUrl: true, isActive: true },
      },
    },
  });

  const seen = new Set<string>();
  const sources = allJunctions
    .map((j) => j.source)
    .filter((s): s is NonNullable<typeof s> => s !== null && s.isActive)
    .filter((s) => { if (seen.has(s.id)) return false; seen.add(s.id); return true; });

  console.log(`\n[scout] ${sources.length} unique active sources to scrape\n`);

  let totalSaved = 0;

  for (const source of sources) {
    try {
      const articles = await scrapeSource(db, source);
      totalSaved += articles;
      if (articles > 0) {
        console.log(`[scout] ${source.name}: ${articles} articles saved\n`);
      }
    } catch (err) {
      console.error(`[scout] FAILED ${source.name}:`, err);
    }
  }

  console.log(`[scout] Complete: ${totalSaved} total articles saved`);
  await disconnectAll();
}

main().catch((err) => {
  console.error("[scout] Fatal:", err);
  process.exit(1);
});
