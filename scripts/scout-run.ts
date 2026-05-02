#!/usr/bin/env tsx
/**
 * scout-run.ts — Smart crawler that follows article links & parses RSS
 */
import "dotenv/config";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { parseStringPromise } from "xml2js";
import { load } from "cheerio";
import { getScoutDb, disconnectAll } from "./lib/prisma.js";

const ARTICLES_DIR = process.env["ARTICLES_DIR"] ?? "./data/articles";
const MAX_ARTICLES_PER_SOURCE = 10;
const CRAWL_TIMEOUT_SECS = 60;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

interface ArticleData {
  url: string;
  title: string;
  content: string;
  publishedAt?: Date;
}

async function saveRawArticle(
  db: ReturnType<typeof getScoutDb>,
  data: { sourceId: string; url: string; title: string; rawContent: string },
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

  await mkdir(ARTICLES_DIR, { recursive: true });
  await writeFile(filePath, data.rawContent, "utf-8");

  const article = await db.article.create({
    data: {
      sourceId: data.sourceId,
      url: data.url,
      title: data.title,
      rawFilePath: filePath,
      status: "SCRAPED",
    },
  });

  return { articleId: article.id, rawFilePath: filePath };
}

// Extract clean article text from HTML
function extractArticleText(html: string, url: string): string {
  const $ = load(html);
  
  // Remove noise
  $("nav, header, footer, aside, .sidebar, .ad, .advertisement, .comments").remove();
  $("script, style, noscript, iframe, .social-share, .newsletter, .related").remove();
  
  // Try to find main content
  let content = $("article");
  if (!content.length) content = $("[role='main']");
  if (!content.length) content = $("main");
  if (!content.length) content = $(".content");
  if (!content.length) content = $(".post");
  if (!content.length) content = $(".entry");
  if (!content.length) content = $("#content");
  if (!content.length) content = $(".main");
  if (!content.length) content = $("body");

  // Get paragraphs and headings (not nav/sidebar items)
  const textParts: string[] = [];
  content.find("p, h1, h2, h3, h4, h5, h6, li").each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 40 && !text.match(/^(click|read|share|follow|sign up|subscribe|advertisement|sponsored)/i)) {
      textParts.push(text);
    }
  });

  return textParts.join("\n\n").slice(0, 15000); // Limit size
}

// Parse RSS/Atom feed and return article URLs
async function parseRssFeed(rssUrl: string): Promise<ArticleData[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout
    const response = await fetch(rssUrl, { 
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: controller.signal
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
      const pubDate = item.pubDate || item.published || item.updated;
      
      if (url && title && typeof url === "string" && typeof title === "string") {
        articles.push({
          url: url.trim(),
          title: title.trim().replace(/<[^>]+>/g, ""),
          content: "", // Will fetch full content
          publishedAt: pubDate ? new Date(pubDate) : undefined,
        });
      }
    }
    
    return articles;
  } catch (err) {
    console.error(`[scout] RSS parse failed for ${rssUrl}:`, err);
    return [];
  }
}

// Find article links on a listing page
async function findArticleLinks(listingUrl: string): Promise<string[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout
    const response = await fetch(listingUrl, { 
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const html = await response.text();
    const $ = load(html);
    const links: string[] = [];
    
    // Look for article links in common patterns
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
    ];
    
    for (const sel of selectors) {
      $(sel).each((_, el) => {
        const href = $(el).attr("href");
        if (href) {
          // Resolve relative URLs
          const fullUrl = href.startsWith("http") 
            ? href 
            : new URL(href, listingUrl).toString();
          
          // Filter out non-article links
          if (!fullUrl.match(/\.(pdf|jpg|png|gif|zip)$/i) && 
              !fullUrl.includes("/tag/") &&
              !fullUrl.includes("/category/") &&
              !fullUrl.includes("/author/") &&
              fullUrl.length > listingUrl.length) {
            links.push(fullUrl);
          }
        }
      });
    }
    
    // Deduplicate and limit
    return [...new Set(links)].slice(0, MAX_ARTICLES_PER_SOURCE);
  } catch (err) {
    console.error(`[scout] Failed to find links on ${listingUrl}:`, err);
    return [];
  }
}

// Crawl a single article URL
async function crawlArticle(url: string): Promise<ArticleData | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000); // 20s timeout
    const response = await fetch(url, { 
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!response.ok) return null;
    
    const html = await response.text();
    const $ = load(html);
    
    const title = $("meta[property='og:title']").attr("content") 
      || $("h1").first().text() 
      || $("title").text()
      || "Untitled";
    
    const content = extractArticleText(html, url);
    
    if (content.length < 200) return null; // Skip if too short
    
    return {
      url,
      title: title.trim().replace(/\s+/g, " ").slice(0, 200),
      content,
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
  
  // 1. Try RSS first (most reliable)
  if (source.rssUrl) {
    const rssArticles = await parseRssFeed(source.rssUrl);
    articlesToFetch.push(...rssArticles);
    console.log(`[scout]   RSS found: ${rssArticles.length} articles`);
  }
  
  // 2. Find article links from listing page
  const links = await findArticleLinks(source.url);
  console.log(`[scout]   Page links found: ${links.length}`);
  
  for (const link of links) {
    if (!articlesToFetch.find(a => a.url === link)) {
      articlesToFetch.push({ url: link, title: "", content: "" });
    }
  }
  
  // 3. Fetch full content for each article
  let saved = 0;
  for (const article of articlesToFetch.slice(0, MAX_ARTICLES_PER_SOURCE)) {
    // Skip if already exists
    const existing = await db.article.findUnique({
      where: { url: article.url },
      select: { id: true },
    });
    if (existing) continue;
    
    // Fetch full content if we only have URL
    if (!article.content) {
      const fullArticle = await crawlArticle(article.url);
      if (!fullArticle) continue;
      Object.assign(article, fullArticle);
    }
    
    // Save
    const result = await saveRawArticle(db, {
      sourceId: source.id,
      url: article.url,
      title: article.title,
      rawContent: article.content,
    });
    
    if (result) {
      saved++;
      console.log(`[scout]   ✓ ${article.title.slice(0, 60)}...`);
    }
  }
  
  return saved;
}

async function main(): Promise<void> {
  const db = getScoutDb();
  console.log("[scout] Starting scout run\n");
  
  // Get all interests and their sources
  const interests = await db.interest.findMany({
    where: { isActive: true },
    select: { id: true, topic: true },
    orderBy: { score: "desc" },
  });
  
  console.log(`[scout] ${interests.length} active interests\n`);
  
  let totalSaved = 0;
  
  for (const interest of interests) {
    const junctions = await db.interestSource.findMany({
      where: { interestId: interest.id },
      include: {
        source: { 
          select: { 
            id: true, 
            name: true, 
            url: true, 
            rssUrl: true 
          } 
        },
      },
    });
    
    const sources = junctions
      .map((j) => j.source)
      .filter((s): s is NonNullable<typeof s> => s !== null);
    
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
  }
  
  console.log(`[scout] Complete: ${totalSaved} total articles saved`);
  await disconnectAll();
}

main().catch((err) => {
  console.error("[scout] Fatal:", err);
  process.exit(1);
});
