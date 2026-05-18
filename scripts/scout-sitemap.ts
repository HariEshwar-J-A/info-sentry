#!/usr/bin/env tsx
/**
 * scout-sitemap.ts — Sitemap-based URL discovery for Info-Sentry
 *
 * Usage:
 *   npx tsx scripts/scout-sitemap.ts --url=https://example.com/sitemap.xml --source=<id>
 *   npx tsx scripts/scout-sitemap.ts --discover=https://example.com --source=<id>
 *
 * Discovers all URLs from a sitemap and queues them for scraping.
 */
import "dotenv/config";
import { XMLParser } from "fast-xml-parser";
import { getScoutDb, disconnectAll } from "./lib/prisma.js";

interface SitemapOptions {
  url?: string;
  discover?: string;
  sourceId: string;
  maxUrls?: number;
  dryRun?: boolean;
}

function parseArgs(): SitemapOptions {
  const args = process.argv.slice(2);
  const options: Partial<SitemapOptions> = { maxUrls: 1000 };

  for (const arg of args) {
    if (arg.startsWith("--url=")) {
      options.url = arg.split("=")[1];
    } else if (arg.startsWith("--discover=")) {
      options.discover = arg.split("=")[1];
    } else if (arg.startsWith("--source=")) {
      options.sourceId = arg.split("=")[1];
    } else if (arg.startsWith("--max-urls=")) {
      options.maxUrls = parseInt(arg.split("=")[1] ?? "100", 10);
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    }
  }

  if (!options.sourceId) {
    console.error("Usage: npx tsx scripts/scout-sitemap.ts --source=<id> [--url=<sitemap-url> | --discover=<base-url>]");
    process.exit(1);
  }

  return options as SitemapOptions;
}

async function discoverSitemap(baseUrl: string): Promise<string | null> {
  const candidates = [
    `${baseUrl}/sitemap.xml`,
    `${baseUrl}/sitemap_index.xml`,
    `${baseUrl}/sitemaps.xml`,
    `${baseUrl}/sitemap/sitemap.xml`,
    `${baseUrl}/wp-sitemap.xml`,
  ];

  for (const url of candidates) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "Info-Sentry Scout/1.0" },
        signal: AbortSignal.timeout(10000),
      });
      if (response.ok) {
        const content = await response.text();
        if (content.includes("<urlset") || content.includes("<sitemapindex")) {
          console.log(`[sitemap] Found sitemap at ${url}`);
          return url;
        }
      }
    } catch {
      // Continue to next candidate
    }
  }

  // Try robots.txt
  try {
    const robotsUrl = `${baseUrl}/robots.txt`;
    const response = await fetch(robotsUrl, { signal: AbortSignal.timeout(5000) });
    if (response.ok) {
      const robots = await response.text();
      const sitemapMatch = robots.match(/Sitemap:\s*(.+)/i);
      if (sitemapMatch) {
        console.log(`[sitemap] Found sitemap in robots.txt: ${sitemapMatch[1]}`);
        return sitemapMatch[1]!.trim();
      }
    }
  } catch {
    // No robots.txt or error
  }

  return null;
}

async function fetchSitemap(url: string): Promise<string[]> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Info-Sentry Scout/1.0",
      "Accept": "application/xml, text/xml, */*",
    },
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch sitemap: ${response.status}`);
  }

  const xml = await response.text();
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
  });

  const data = parser.parse(xml);
  const urls: string[] = [];

  // Handle sitemap index
  if (data.sitemapindex?.sitemap) {
    const sitemaps = Array.isArray(data.sitemapindex.sitemap)
      ? data.sitemapindex.sitemap
      : [data.sitemapindex.sitemap];

    console.log(`[sitemap] Found ${sitemaps.length} sub-sitemaps`);

    for (const sitemap of sitemaps.slice(0, 5)) { // Limit sub-sitemaps
      const loc = sitemap.loc;
      if (loc) {
        const subUrls = await fetchSitemap(loc);
        urls.push(...subUrls);
      }
    }
  }

  // Handle urlset
  if (data.urlset?.url) {
    const urlEntries = Array.isArray(data.urlset.url)
      ? data.urlset.url
      : [data.urlset.url];

    for (const entry of urlEntries) {
      if (entry.loc && typeof entry.loc === "string") {
        urls.push(entry.loc.trim());
      }
    }
  }

  return urls.filter((u) => u.startsWith("http"));
}

async function discoverUrls(options: SitemapOptions): Promise<string[]> {
  let sitemapUrl = options.url;

  if (!sitemapUrl && options.discover) {
    sitemapUrl = await discoverSitemap(options.discover) ?? undefined;
  }

  if (!sitemapUrl) {
    throw new Error("Could not discover sitemap URL");
  }

  console.log(`[sitemap] Fetching from ${sitemapUrl}`);
  const urls = await fetchSitemap(sitemapUrl);

  // Filter to recent URLs (last 30 days) if lastmod is available
  // For now, just take the most recent ones
  return urls.slice(0, options.maxUrls);
}

async function main(): Promise<void> {
  const options = parseArgs();
  const db = getScoutDb();

  // Verify source exists
  const source = await db.source.findUnique({
    where: { id: options.sourceId },
    select: { id: true, name: true, url: true },
  });

  if (!source) {
    console.error(`Source ${options.sourceId} not found`);
    await disconnectAll();
    process.exit(1);
  }

  console.log(`[sitemap] Processing source: ${source.name}`);

  try {
    const urls = await discoverUrls(options);
    console.log(`[sitemap] Discovered ${urls.length} URLs`);

    if (options.dryRun) {
      console.log("[sitemap] Dry run mode - not saving");
      console.log("First 5 URLs:");
      urls.slice(0, 5).forEach((u) => console.log(`  - ${u}`));
    } else {
      // In a full implementation, we would save these as pending scrapes
      // For now, just report
      console.log(`[sitemap] Would queue ${urls.length} URLs for scraping`);

      // Could create pending scrape records here
      // await db.pendingScrape.createMany(...)
    }

    await disconnectAll();
    console.log("[sitemap] Complete");
  } catch (err) {
    console.error("[sitemap] Error:", err);
    await disconnectAll();
    process.exit(1);
  }
}

main();
