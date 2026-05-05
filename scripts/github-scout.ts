#!/usr/bin/env tsx
/**
 * github-scout.ts — Discover and store trending GitHub repositories per topic.
 *
 * Usage:
 *   npx tsx scripts/github-scout.ts                       # all active interests
 *   npx tsx scripts/github-scout.ts --interestId=<id>     # single interest
 *   npx tsx scripts/github-scout.ts --dryRun              # log only, no DB writes
 *
 * Env vars:
 *   GITHUB_TOKEN  — Personal access token (optional; unauthenticated = 10 search req/min)
 *   MAX_REPOS_PER_TOPIC  (default: 30) — repos to fetch per interest
 *   MIN_STARS            (default: 50) — skip repos below this threshold
 *
 * Algorithm per interest:
 *   1. Build 2 GitHub search queries (topic name + top keywords)
 *   2. Fetch top repos sorted by stars (authenticated: up to 30 per query)
 *   3. For each new repo: fetch raw README from GitHub CDN
 *   4. Upsert GitHubRepo record (update stars/forks on re-runs)
 */
import "dotenv/config";
import { getScoutDb, disconnectAll } from "./lib/prisma.js";

// ─── Config ────────────────────────────────────────────────

const MAX_REPOS_PER_TOPIC = parseInt(process.env["MAX_REPOS_PER_TOPIC"] ?? "30", 10);
const MIN_STARS = parseInt(process.env["MIN_STARS"] ?? "50", 10);
const README_MAX_CHARS = 8_000;
const GITHUB_TOKEN = process.env["GITHUB_TOKEN"];
const REQUEST_DELAY_MS = GITHUB_TOKEN ? 250 : 800; // authenticated = faster

// ─── GitHub API types ──────────────────────────────────────

interface GHRepo {
  id: number;
  full_name: string;
  name: string;
  owner: { login: string };
  description: string | null;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  watchers_count: number;
  language: string | null;
  topics: string[];
  pushed_at: string | null;
  default_branch: string;
}

interface GHSearchResult {
  total_count: number;
  items: GHRepo[];
}

// ─── Fetch helpers ─────────────────────────────────────────

function githubHeaders(): HeadersInit {
  const h: HeadersInit = {
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "InfoSentry/1.0",
  };
  if (GITHUB_TOKEN) h["Authorization"] = `Bearer ${GITHUB_TOKEN}`;
  return h;
}

async function githubFetch(url: string, timeoutMs = 10_000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: githubHeaders(), signal: ctrl.signal });
    // Respect rate limit
    const remaining = parseInt(res.headers.get("X-RateLimit-Remaining") ?? "60", 10);
    if (remaining < 5 && remaining > 0) {
      const reset = parseInt(res.headers.get("X-RateLimit-Reset") ?? "0", 10);
      const wait = Math.max(0, reset * 1000 - Date.now()) + 1000;
      console.log(`[github] Rate limit low (${remaining} remaining) — waiting ${Math.ceil(wait / 1000)}s`);
      await new Promise(r => setTimeout(r, wait));
    }
    return res;
  } finally {
    clearTimeout(t);
  }
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ─── Search GitHub repos for a topic ──────────────────────

async function searchRepos(query: string, perPage = 30): Promise<GHRepo[]> {
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=${perPage}`;
  try {
    const res = await githubFetch(url);
    if (res.status === 422) {
      console.warn(`[github]   Search query invalid: ${query}`);
      return [];
    }
    if (!res.ok) {
      console.warn(`[github]   Search failed ${res.status}: ${query}`);
      return [];
    }
    const data = (await res.json()) as GHSearchResult;
    return data.items ?? [];
  } catch {
    return [];
  }
}

// ─── Fetch README content ──────────────────────────────────

async function fetchReadme(owner: string, repo: string, branch: string): Promise<string | null> {
  // Try raw GitHub CDN first (faster, no API rate limit)
  const rawUrls = [
    `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/README.md`,
    `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/readme.md`,
    `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/README.rst`,
    `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/README.md`,
  ];

  for (const url of rawUrls) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8_000);
      const res = await fetch(url, {
        headers: { "User-Agent": "InfoSentry/1.0" },
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (res.ok) {
        const text = await res.text();
        if (text.length > 50) return text.slice(0, README_MAX_CHARS);
      }
    } catch { /* try next */ }
  }

  // Fallback to GitHub API (counts against rate limit)
  try {
    const res = await githubFetch(`https://api.github.com/repos/${owner}/${repo}/readme`);
    if (res.ok) {
      const data = (await res.json()) as { content: string; encoding: string };
      if (data.encoding === "base64") {
        const decoded = Buffer.from(data.content, "base64").toString("utf-8");
        return decoded.slice(0, README_MAX_CHARS);
      }
    }
  } catch { /* ignore */ }

  return null;
}

// ─── Format large numbers ──────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

// ─── Process one interest ──────────────────────────────────

async function processInterest(
  db: ReturnType<typeof getScoutDb>,
  interest: { id: string; topic: string; description: string | null; searchKeywords: string[] },
  dryRun: boolean,
): Promise<number> {
  console.log(`\n[github] ── "${interest.topic}" ──`);

  // Build 2 query variations
  const topKeywords = interest.searchKeywords.slice(0, 3).join(" ");
  const queries = [
    `${interest.topic} in:name,description,topics`,
    topKeywords ? `${topKeywords} stars:>=${MIN_STARS}` : `${interest.topic} stars:>=${MIN_STARS}`,
  ];

  // Fetch and deduplicate repos across queries
  const repoMap = new Map<string, GHRepo>();
  for (const q of queries) {
    const repos = await searchRepos(q, Math.ceil(MAX_REPOS_PER_TOPIC / queries.length) + 5);
    for (const r of repos) {
      if (r.stargazers_count >= MIN_STARS && !repoMap.has(r.full_name)) {
        repoMap.set(r.full_name, r);
      }
    }
    await sleep(REQUEST_DELAY_MS);
  }

  // Sort by stars descending, take top N
  const repos = [...repoMap.values()]
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .slice(0, MAX_REPOS_PER_TOPIC);

  console.log(`[github]   Found ${repos.length} repos (${repoMap.size} candidates)`);

  let saved = 0;
  for (const repo of repos) {
    const lastPushed = repo.pushed_at ? new Date(repo.pushed_at) : null;

    if (dryRun) {
      console.log(`[github]   [DRY] ${repo.full_name} ⭐${fmtNum(repo.stargazers_count)} 🔀${fmtNum(repo.forks_count)}`);
      saved++;
      continue;
    }

    // Fetch README for new repos only (saves API quota)
    const existing = await db.gitHubRepo.findUnique({
      where: { fullName: repo.full_name },
      select: { id: true, readme: true, stars: true, forks: true },
    });

    let readme: string | null = existing?.readme ?? null;
    if (!existing) {
      readme = await fetchReadme(repo.owner.login, repo.name, repo.default_branch);
      await sleep(REQUEST_DELAY_MS);
    }

    // Track star/fork deltas for trending detection
    const starDelta = existing ? repo.stargazers_count - (existing.stars ?? 0) : 0;
    const forkDelta = existing ? repo.forks_count - (existing.forks ?? 0) : 0;

    await db.gitHubRepo.upsert({
      where: { fullName: repo.full_name },
      update: {
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        watchers: repo.watchers_count,
        language: repo.language,
        topics: repo.topics,
        description: repo.description,
        lastPushed,
        previousStars: existing?.stars ?? null,
        previousForks: existing?.forks ?? null,
        starDelta,
        forkDelta,
        fetchCount: { increment: 1 },
        updatedAt: new Date(),
      },
      create: {
        interestId: interest.id,
        owner: repo.owner.login,
        repoName: repo.name,
        fullName: repo.full_name,
        description: repo.description,
        url: repo.html_url,
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        watchers: repo.watchers_count,
        language: repo.language,
        topics: repo.topics,
        readme,
        defaultBranch: repo.default_branch,
        lastPushed,
        starDelta: 0,
        forkDelta: 0,
        fetchCount: 1,
      },
    });

    const trendStr = starDelta > 0 ? ` (+${fmtNum(starDelta)}⭐)` : "";
    const action = existing ? "updated" : "saved";
    console.log(`[github]   ✓ ${action}: ${repo.full_name} ⭐${fmtNum(repo.stargazers_count)}${trendStr} 🔀${fmtNum(repo.forks_count)}${readme && !existing ? " +README" : ""}`);
    saved++;
  }

  if (!dryRun && saved > 0) {
    // Upsert a Source record so this interest's GitHub scan appears in the Sources panel
    const ghSource = await db.source.upsert({
      where: { url: `https://github.com/search?q=${encodeURIComponent(interest.topic)}&type=repositories&sort=stars` },
      create: {
        name: `GitHub: ${interest.topic}`,
        url: `https://github.com/search?q=${encodeURIComponent(interest.topic)}&type=repositories&sort=stars`,
        type: "GITHUB",
        trustScore: 0.9,
        isActive: true,
      },
      update: { isActive: true },
    });
    await db.interestSource.upsert({
      where: { interestId_sourceId: { interestId: interest.id, sourceId: ghSource.id } },
      update: {},
      create: { interestId: interest.id, sourceId: ghSource.id },
    });
    console.log(`[github]   📡 Source record upserted: ${ghSource.name}`);
  }

  return saved;
}

// ─── Main ──────────────────────────────────────────────────

async function main() {
  const args = Object.fromEntries(
    process.argv.slice(2).map(a => a.replace(/^--/, "").split("=")),
  ) as { interestId?: string; dryRun?: string };

  const dryRun = args.dryRun === "true" || args.dryRun === "";
  const db = getScoutDb();

  console.log("[github] ═══════════════════════════════════════");
  console.log(`[github] GitHub Scout — ${GITHUB_TOKEN ? "authenticated" : "unauthenticated (add GITHUB_TOKEN for higher rate limits)"}`);
  if (dryRun) console.log("[github] DRY RUN — no DB writes");
  console.log("[github] ═══════════════════════════════════════");

  const where = args.interestId ? { id: args.interestId } : { isActive: true };
  const interests = await db.interest.findMany({
    where,
    select: { id: true, topic: true, description: true, searchKeywords: true },
    orderBy: { score: "desc" },
  });

  console.log(`[github] ${interests.length} interest(s) to process\n`);

  let totalSaved = 0;
  for (const interest of interests) {
    try {
      const n = await processInterest(db, interest, dryRun);
      totalSaved += n;
    } catch (err) {
      console.error(`[github] ERROR for "${interest.topic}": ${(err as Error).message}`);
    }
  }

  await db.agentConfig.upsert({
    where: { agentName: "github-scout" },
    update: { lastRunAt: new Date(), lastError: null },
    create: { agentName: "github-scout", lastRunAt: new Date() },
  }).catch(() => {});

  console.log("\n[github] ═══════════════════════════════════════");
  console.log(`[github] Complete — ${totalSaved} repos processed`);
  console.log("[github] ═══════════════════════════════════════");
  await disconnectAll();
}

main().catch(err => {
  console.error("[github] Fatal:", err);
  process.exit(1);
});
