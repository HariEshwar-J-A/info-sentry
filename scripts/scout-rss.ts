#!/usr/bin/env tsx
/**
 * scout-rss.ts — RSS/Atom feed parser for Info-Sentry
 *
 * Usage:
 *   npx tsx scripts/scout-rss.ts --feed=<rss-url> --source=<id>
 *   npx tsx scripts/scout-rss.ts --source=<id>  (uses source.rssUrl)
 *
 * Parses RSS/Atom feeds and saves articles efficiently.
 */
import "dotenv/config";
import Parser from "rss-parser";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { getScoutDb, disconnectAll } from "./lib/prisma.js";

const ARTICLES_DIR = process.env["ARTICLES_DIR"] ?? "./data/articles";

interface RSSOptions {
  feed?: string;
  sourceId: string;
  maxItems?: number;
  dryRun?: boolean;
}

function parseArgs(): RSSOptions {
  const args = process.argv.slice(2);
  const options: Partial<RSSOptions> = { maxItems: 50 };

  for (const arg of args) {
    if (arg.startsWith("--feed=")) {
      options.feed = arg.split("=")[1];
    } else if (arg.startsWith("--source=")) {
      options.sourceId = arg.split("=")[1];
    } else if (arg.startsWith("--max-items=")) {
      options.maxItems = parseInt(arg.split("=")[1] ?? "10", 10);
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    }
  }

  if (!options.sourceId) {
    console.error("Usage: npx tsx scripts/scout-rss.ts --source=<id> [--feed=<rss-url>]");
    process.exit(1);
  }

  return options as RSSOptions;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

async function parseFeed(feedUrl: string): Promise<Parser.Item[]> {
  const parser = new Parser({
    headers: {
      "User-Agent": "Info-Sentry Scout/1.0 (News Aggregator Bot)",
      "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
    },
    timeout: 20000,
    maxRedirects: 5,
  });

  console.log(`[rss] Fetching ${feedUrl}`);
  const feed = await parser.parseURL(feedUrl);
  console.log(`[rss] Feed: ${feed.title}`);
  console.log(`[rss] Items: ${feed.items?.length || 0}`);

  return feed.items || [];
}

function cleanContent(item: Parser.Item): string {
  // Prefer content:encoded (full content) over description (summary)
  const rawContent =
    (item as any)["content:encoded"] ||
    item.content ||
    item.summary ||
    "";

  // Basic cleanup
  return rawContent
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUrl(url: string): string {
  // Remove tracking parameters
  try {
    const urlObj = new URL(url);
    const trackingParams = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "fbclid", "gclid", "ref"];
    trackingParams.forEach((p) => urlObj.searchParams.delete(p));
    return urlObj.toString();
  } catch {
    return url;
  }
}

async function parseISODate(dateStr?: string): Promise<Date | undefined> {
  if (!dateStr) return undefined;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? undefined : d;
}

async function main(): Promise<void> {
  const options = parseArgs();
  const db = getScoutDb();

  // Get source
  const source = await db.source.findUnique({
    where: { id: options.sourceId },
    select: { id: true, name: true, rssUrl: true },
  });

  if (!source) {
    console.error(`[rss] Source ${options.sourceId} not found`);
    await disconnectAll();
    process.exit(1);
  }

  const feedUrl = options.feed || source.rssUrl;
  if (!feedUrl) {
    console.error(`[rss] No feed URL provided and source has no rssUrl`);
    await disconnectAll();
    process.exit(1);
  }

  try {
    // Parse feed
    const items = await parseFeed(feedUrl);
    const toProcess = items.slice(0, options.maxItems);

    console.log(`[rss] Processing ${toProcess.length} items\n`);

    let saved = 0;
    let skipped = 0;
    let errors = 0;

    for (const item of toProcess) {
      const url = normalizeUrl(item.link || item.guid || "");
      if (!url) {
        console.log(`[rss] Skipping item without URL: ${item.title}`);
        continue;
      }

      // Check for duplicate
      const existing = await db.article.findUnique({
        where: { url },
        select: { id: true },
      });

      if (existing) {
        skipped++;
        console.log(`[rss] ⚡ Already exists: ${item.title?.slice(0, 60)}...`);
        continue;
      }

      if (options.dryRun) {
        console.log(`[rss] 📄 Would save: ${item.title?.slice(0, 60)}...`);
        saved++;
        continue;
      }

      try {
        const title = item.title || "Untitled";
        const content = cleanContent(item);
        const publishedAt = await parseISODate(item.pubDate || item.isoDate);

        // Build markdown content
        const markdown = `# ${title}

**Source:** ${source.name}
**Published:** ${publishedAt?.toISOString() || "Unknown"}
**URL:** ${url}

---

${content}
`;

        // Save to file
        const timestamp = Date.now();
        const slug = slugify(title);
        const filename = `${source.id}_${timestamp}_${slug}.md`;
        const filePath = join(ARTICLES_DIR, filename);

        await mkdir(ARTICLES_DIR, { recursive: true });
        await writeFile(filePath, markdown, "utf-8");

        // Save to database
        await db.article.create({
          data: {
            sourceId: source.id,
            url,
            title,
            rawFilePath: filePath,
            status: "SCRAPED",
          },
        });

        saved++;
        console.log(`[rss] ✅ Saved: ${title.slice(0, 60)}...`);
      } catch (err) {
        errors++;
        console.error(`[rss] ❌ Failed: ${item.title?.slice(0, 60)}...`, err);
      }
    }

    console.log(`\n[rss] Complete: ${saved} saved, ${skipped} skipped, ${errors} errors`);
    await disconnectAll();
  } catch (err) {
    console.error("[rss] Error:", err);
    await disconnectAll();
    process.exit(1);
  }
}

main();
