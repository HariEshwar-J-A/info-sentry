#!/usr/bin/env tsx
/**
 * source-discovery.ts — Automatic reliable source discovery for a topic.
 *
 * Usage: npx tsx scripts/source-discovery.ts --interestId=<id> [--dryRun]
 *
 * Algorithm:
 *   1. Run 6 query variations across Google News RSS + DuckDuckGo HTML
 *   2. Extract unique domains from results (target: 100+)
 *   3. Score each domain: frequency × authority bonus × freshness bonus
 *   4. Pick top 20 scored domains not already linked to the interest
 *   5. Probe each domain for RSS feed (checks 8 common paths)
 *   6. Create Source records and link to interest (hard max: 50 per topic)
 *
 * Output: JSON { added: Source[], skipped: string[], reason: string }
 */
import "dotenv/config";
import { parseStringPromise } from "xml2js";
import { load } from "cheerio";
import { getScoutDb, disconnectAll } from "./lib/prisma.js";

// ─── Config ────────────────────────────────────────────────

const MAX_SOURCES_PER_TOPIC = 50;   // hard limit
const DISCOVER_TOP_N = 20;          // domains to add per discovery run
const MIN_DOMAIN_FREQ = 2;          // domain must appear this many times across queries
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

// Well-known high-authority domains that get a score multiplier
const AUTHORITY_DOMAINS = new Set([
  "nytimes.com", "theguardian.com", "bbc.com", "bbc.co.uk", "reuters.com",
  "apnews.com", "washingtonpost.com", "wsj.com", "ft.com", "bloomberg.com",
  "techcrunch.com", "wired.com", "arstechnica.com", "theverge.com",
  "forbes.com", "businessinsider.com", "cnbc.com", "cnn.com", "nbcnews.com",
  "politico.com", "axios.com", "vox.com", "theatlantic.com", "time.com",
  "nature.com", "science.org", "scientificamerican.com", "ieee.org",
  "technologyreview.com", "venturebeat.com", "zdnet.com", "engadget.com",
  "rollingstone.com", "billboard.com", "variety.com", "hollywoodreporter.com",
  "espn.com", "si.com", "sportingnews.com",
  "healthline.com", "webmd.com", "mayoclinic.org", "nih.gov", "cdc.gov",
  "economist.com", "hbr.org", "mckinsey.com", "mit.edu", "stanford.edu",
]);

// Domains to always skip (aggregators, login-walls, irrelevant infra)
const SKIP_DOMAINS = new Set([
  "google.com", "news.google.com", "youtube.com", "twitter.com", "x.com",
  "facebook.com", "instagram.com", "linkedin.com", "reddit.com",
  "wikipedia.org", "amazon.com", "ebay.com", "apple.com", "microsoft.com",
  "github.com", "stackoverflow.com", "medium.com", "substack.com",
  "archive.org", "web.archive.org",
]);

// Common RSS feed paths to probe
const RSS_PATHS = [
  "/feed", "/feed.xml", "/rss", "/rss.xml", "/rss/feed", "/feed/rss",
  "/index.xml", "/feeds/posts/default", "/atom.xml", "/news.rss",
  "/feed/atom", "/sitemap.xml", "/rss/all",
];

// ─── Helpers ───────────────────────────────────────────────

async function fetchWithTimeout(url: string, ms = 8000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { headers: HEADERS, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

function extractDomain(url: string): string | null {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    // Filter single-word hostnames (localhost etc.) and IPs
    if (host.includes(".") && !host.match(/^\d+\.\d+\.\d+\.\d+$/)) return host;
    return null;
  } catch {
    return null;
  }
}

// ─── Search strategies ─────────────────────────────────────

/** Query Google News RSS, return all link domains found */
async function googleNewsSearch(query: string): Promise<string[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en&gl=US&ceid=US:en`;
  try {
    const res = await fetchWithTimeout(url, 10_000);
    if (!res.ok) return [];
    const xml = await res.text();
    const parsed = await parseStringPromise(xml, { explicitArray: false });
    const items = parsed.rss?.channel?.item ?? [];
    const arr = Array.isArray(items) ? items : [items];

    const domains: string[] = [];
    for (const item of arr) {
      // Google News RSS has <source url="..."> with the actual publisher domain
      const srcUrl: string = item.source?.$?.url ?? item.source?.url ?? "";
      const linkUrl: string = item.link ?? "";
      const d = extractDomain(srcUrl) ?? extractDomain(linkUrl);
      if (d && !SKIP_DOMAINS.has(d)) domains.push(d);
    }
    return domains;
  } catch {
    return [];
  }
}

/** DuckDuckGo HTML search, return result domains */
async function duckduckgoSearch(query: string): Promise<string[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  try {
    const res = await fetchWithTimeout(url, 12_000);
    if (!res.ok) return [];
    const $ = load(await res.text());
    const domains: string[] = [];
    $(".result__url").each((_, el) => {
      const text = $(el).text().trim();
      if (text) {
        const d = extractDomain(`https://${text}`);
        if (d && !SKIP_DOMAINS.has(d)) domains.push(d);
      }
    });
    $(".result__a[href]").each((_, el) => {
      const href = $(el).attr("href") ?? "";
      // DuckDuckGo uses redirect links like //duckduckgo.com/l/?uddg=https%3A...
      const match = href.match(/uddg=([^&]+)/);
      if (match) {
        const decoded = decodeURIComponent(match[1]);
        const d = extractDomain(decoded);
        if (d && !SKIP_DOMAINS.has(d)) domains.push(d);
      }
    });
    return domains;
  } catch {
    return [];
  }
}

/** Probe a domain for an RSS feed, return the feed URL if found */
async function probeRss(domain: string): Promise<string | null> {
  // First check: /feed or /rss on the main site
  for (const path of RSS_PATHS) {
    const url = `https://${domain}${path}`;
    try {
      const res = await fetchWithTimeout(url, 5000);
      if (!res.ok) continue;
      const ct = res.headers.get("content-type") ?? "";
      if (ct.includes("xml") || ct.includes("rss") || ct.includes("atom")) {
        // Verify it has actual feed content
        const text = await res.text();
        if (text.includes("<rss") || text.includes("<feed") || text.includes("<channel")) {
          return url;
        }
      }
    } catch { /* skip */ }
  }

  // Second check: look for RSS link in the homepage HTML
  try {
    const res = await fetchWithTimeout(`https://${domain}`, 8000);
    if (res.ok) {
      const $ = load(await res.text());
      const rssLink =
        $('link[type="application/rss+xml"]').attr("href") ??
        $('link[type="application/atom+xml"]').attr("href");
      if (rssLink) {
        const full = rssLink.startsWith("http") ? rssLink : `https://${domain}${rssLink}`;
        return full;
      }
    }
  } catch { /* skip */ }

  return null;
}

// ─── Main discovery logic ───────────────────────────────────

interface DiscoveredSource {
  domain: string;
  url: string;
  rssUrl: string | null;
  score: number;
  frequency: number;
  isAuthority: boolean;
}

async function discoverSources(
  topic: string,
  keywords: string[],
  description: string | null,
): Promise<DiscoveredSource[]> {
  // Build 6 query variations to cast a wide net
  const baseKeywords = keywords.slice(0, 4).join(" ");
  const queries = [
    topic,
    `${topic} news`,
    `${topic} latest`,
    baseKeywords || topic,
    description ? description.split(/\s+/).slice(0, 6).join(" ") : `${topic} updates`,
    `${topic} analysis`,
  ].filter((q, i, a) => a.indexOf(q) === i); // deduplicate

  console.log(`[discovery] Running ${queries.length} queries for "${topic}"`);

  // Execute all searches in parallel
  const domainFreq = new Map<string, number>();

  const allResults = await Promise.allSettled([
    ...queries.map((q) => googleNewsSearch(q)),
    ...queries.slice(0, 3).map((q) => duckduckgoSearch(q)),
  ]);

  for (const result of allResults) {
    if (result.status === "fulfilled") {
      for (const domain of result.value) {
        domainFreq.set(domain, (domainFreq.get(domain) ?? 0) + 1);
      }
    }
  }

  console.log(`[discovery] Found ${domainFreq.size} unique domains`);

  // Score domains: frequency + authority bonus
  const scored: DiscoveredSource[] = [];
  for (const [domain, freq] of domainFreq.entries()) {
    if (freq < MIN_DOMAIN_FREQ) continue; // must appear at least twice
    const isAuthority = AUTHORITY_DOMAINS.has(domain);
    const score = freq * (isAuthority ? 3 : 1);
    scored.push({
      domain,
      url: `https://${domain}`,
      rssUrl: null,
      score,
      frequency: freq,
      isAuthority,
    });
  }

  // Sort by score descending, take top 40 candidates for RSS probing
  scored.sort((a, b) => b.score - a.score);
  const candidates = scored.slice(0, 40);

  console.log(`[discovery] Probing RSS for top ${candidates.length} candidates...`);

  // Probe RSS feeds in parallel (10 concurrent)
  const withRss: DiscoveredSource[] = [];
  const probeBatch = async (batch: DiscoveredSource[]) => {
    await Promise.allSettled(
      batch.map(async (c) => {
        const rss = await probeRss(c.domain);
        c.rssUrl = rss;
      }),
    );
    withRss.push(...batch);
  };

  for (let i = 0; i < candidates.length; i += 10) {
    await probeBatch(candidates.slice(i, i + 10));
  }

  // Prioritise domains with RSS feeds, then by score
  withRss.sort((a, b) => {
    const rssBonus = (b.rssUrl ? 10 : 0) - (a.rssUrl ? 10 : 0);
    return rssBonus || b.score - a.score;
  });

  return withRss;
}

// ─── CLI entry ──────────────────────────────────────────────

async function main() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")),
  ) as { interestId?: string; dryRun?: string };

  if (!args.interestId) {
    console.error("Usage: npx tsx scripts/source-discovery.ts --interestId=<id> [--dryRun]");
    process.exit(1);
  }

  const dryRun = args.dryRun === "true" || args.dryRun === "";
  const db = getScoutDb();

  const interest = await db.interest.findUnique({
    where: { id: args.interestId },
    select: { id: true, topic: true, description: true, searchKeywords: true },
  });

  if (!interest) {
    console.error(`Interest ${args.interestId} not found`);
    process.exit(1);
  }

  console.log(`[discovery] Topic: "${interest.topic}"${dryRun ? " [DRY RUN]" : ""}`);

  // Count current sources for this interest
  const currentCount = await db.interestSource.count({ where: { interestId: interest.id } });
  const slotsAvailable = MAX_SOURCES_PER_TOPIC - currentCount;

  if (slotsAvailable <= 0) {
    const result = { added: [], skipped: [], reason: `Hard limit reached (${MAX_SOURCES_PER_TOPIC} sources per topic)` };
    console.log(JSON.stringify(result));
    await disconnectAll();
    return;
  }

  // Get already-linked source domains to skip them
  const existing = await db.interestSource.findMany({
    where: { interestId: interest.id },
    include: { source: { select: { url: true } } },
  });
  const existingDomains = new Set(
    existing.map((e) => extractDomain(e.source.url)).filter(Boolean) as string[],
  );

  // Discover sources
  const discovered = await discoverSources(interest.topic, interest.searchKeywords, interest.description);

  // Filter out already-linked domains, take top N up to available slots
  const toAdd = discovered
    .filter((d) => !existingDomains.has(d.domain))
    .slice(0, Math.min(DISCOVER_TOP_N, slotsAvailable));

  console.log(`\n[discovery] Adding ${toAdd.length} sources (${slotsAvailable} slots available, hard limit ${MAX_SOURCES_PER_TOPIC})`);

  const added: { name: string; url: string; rssUrl: string | null; trustScore: number }[] = [];
  const skipped: string[] = [];

  for (const candidate of toAdd) {
    const trustScore = candidate.isAuthority ? 0.85 : candidate.rssUrl ? 0.7 : 0.55;
    const name = candidate.domain.replace(/\.(com|org|net|co\.uk|io)$/, "").replace(/-/g, " ")
      .split(".").pop() ?? candidate.domain;
    const sourceName = name.charAt(0).toUpperCase() + name.slice(1);

    if (dryRun) {
      console.log(`[discovery] [DRY RUN] Would add: ${candidate.domain} (score=${candidate.score}, rss=${!!candidate.rssUrl})`);
      added.push({ name: sourceName, url: candidate.url, rssUrl: candidate.rssUrl, trustScore });
      continue;
    }

    try {
      const source = await db.source.upsert({
        where: { url: candidate.url },
        create: { name: sourceName, url: candidate.url, rssUrl: candidate.rssUrl, trustScore, isActive: true },
        update: { ...(candidate.rssUrl ? { rssUrl: candidate.rssUrl } : {}), isActive: true },
      });

      await db.interestSource.upsert({
        where: { interestId_sourceId: { interestId: interest.id, sourceId: source.id } },
        update: {},
        create: { interestId: interest.id, sourceId: source.id },
      });

      added.push({ name: sourceName, url: candidate.url, rssUrl: candidate.rssUrl, trustScore });
      console.log(`[discovery] ✓ ${candidate.domain} (trust=${trustScore.toFixed(2)}, rss=${!!candidate.rssUrl})`);
    } catch (err) {
      skipped.push(candidate.domain);
      console.error(`[discovery] ✗ ${candidate.domain}: ${(err as Error).message}`);
    }
  }

  const result = {
    topic: interest.topic,
    added,
    skipped,
    totalCandidates: discovered.length,
    slotsRemaining: slotsAvailable - added.length,
    hardLimit: MAX_SOURCES_PER_TOPIC,
  };

  console.log(`\n[discovery] Done: ${added.length} added, ${skipped.length} failed`);
  console.log(JSON.stringify(result));
  await disconnectAll();
}

main().catch((err) => {
  console.error("[discovery] Fatal:", err);
  process.exit(1);
});
