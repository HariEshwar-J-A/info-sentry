#!/usr/bin/env tsx
/**
 * scout-run.ts — Crawl sources for each active interest and save raw articles.
 *
 * Triggered by OpenClaw cron every 2h at :00.
 * Uses Crawlee (Cheerio or Playwright per source).
 * Writes articles to disk + DB with status SCRAPED.
 */
import "dotenv/config";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  CheerioCrawler,
  PlaywrightCrawler,
  type CheerioCrawlingContext,
  type PlaywrightCrawlingContext,
} from "crawlee";
import { getScoutDb, disconnectAll } from "./lib/prisma.js";

const ARTICLES_DIR = process.env["ARTICLES_DIR"] ?? "./data/articles";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

interface FoundArticle {
  url: string;
  title: string;
  content: string;
}

async function saveRawArticle(
  db: ReturnType<typeof getScoutDb>,
  data: { sourceId: string; url: string; title: string; rawContent: string },
): Promise<{ articleId: string; rawFilePath: string } | null> {
  // Check duplicate
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

async function scrapeSource(
  db: ReturnType<typeof getScoutDb>,
  source: { id: string; name: string; url: string; crawlMethod: "CHEERIO" | "PLAYWRIGHT"; rssUrl: string | null },
): Promise<number> {
  const articlesFound: FoundArticle[] = [];
  const startUrls = [source.url];
  if (source.rssUrl) startUrls.push(source.rssUrl);

  if (source.crawlMethod === "PLAYWRIGHT") {
    const crawler = new PlaywrightCrawler({
      maxRequestsPerCrawl: 20,
      requestHandlerTimeoutSecs: 30,
      headless: true,
      launchContext: {
        launchOptions: { args: ["--no-sandbox", "--disable-setuid-sandbox"] },
      },
      requestHandler: async (ctx: PlaywrightCrawlingContext) => {
        const pageContent = await ctx.page.content();
        if (pageContent.length > 100) {
          const pageTitle = await ctx.page.title();
          articlesFound.push({
            url: ctx.request.url,
            title: pageTitle || ctx.request.url,
            content: pageContent,
          });
        }
      },
    });
    await crawler.run(startUrls);
  } else {
    const crawler = new CheerioCrawler({
      maxRequestsPerCrawl: 20,
      requestHandlerTimeoutSecs: 30,
      requestHandler: async (ctx: CheerioCrawlingContext) => {
        const $ = ctx.$;
        const title =
          $("meta[property='og:title']").attr("content") ??
          $("title").text() ??
          $("h1").first().text() ??
          ctx.request.url;

        const contentEl = $("article").length ? $("article") : $("main").length ? $("main") : $("body");
        contentEl.find("nav, footer, script, style, aside, .ad, .advertisement, .sidebar").remove();
        const textContent = contentEl.text().replace(/\s+/g, " ").trim();

        if (textContent.length > 100) {
          articlesFound.push({ url: ctx.request.url, title: title.trim(), content: textContent });
        }
      },
    });
    await crawler.run(startUrls);
  }

  let saved = 0;
  for (const article of articlesFound) {
    try {
      const result = await saveRawArticle(db, {
        sourceId: source.id,
        url: article.url,
        title: article.title,
        rawContent: article.content,
      });
      if (result) saved++;
    } catch (err) {
      console.error(`[scout] Failed to save article ${article.url}:`, err);
    }
  }

  return saved;
}

async function main(): Promise<void> {
  const db = getScoutDb();
  console.log("[scout] Starting scout run");

  const interests = await db.interest.findMany({
    where: { isActive: true },
    select: { id: true, topic: true },
    orderBy: { score: "desc" },
  });

  console.log(`[scout] ${interests.length} active interests`);
  let totalSaved = 0;

  for (const interest of interests) {
    const junctions = await db.interestSource.findMany({
      where: { interestId: interest.id },
      include: {
        source: {
          select: { id: true, name: true, url: true, crawlMethod: true, rssUrl: true },
        },
      },
    });

    const sources = junctions.map((j) => j.source).filter((s): s is NonNullable<typeof s> => s !== null);

    for (const source of sources) {
      try {
        const saved = await scrapeSource(db, source);
        totalSaved += saved;
        console.log(`[scout] ${source.name}: ${saved} new articles`);
      } catch (err) {
        console.error(`[scout] Failed to scrape ${source.url}:`, err);
      }
    }
  }

  console.log(`[scout] Run complete. ${totalSaved} new articles saved.`);
  await disconnectAll();
}

main().catch((err) => {
  console.error("[scout] Fatal:", err);
  process.exit(1);
});
