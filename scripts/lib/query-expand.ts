/**
 * LLM expands a coarse interest into several precise news search queries.
 * Cached per interest per calendar day on disk.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { chatCompletion } from "./openrouter.js";
import { getQueryExpandModel } from "./scout-llm-defaults.js";
import { truncateForSearchQuery } from "./scout-interest-focus.js";

export interface InterestShape {
  id: string;
  topic: string;
  description: string | null;
  searchKeywords: string[];
}

const CACHE_ROOT =
  process.env["QUERY_EXPAND_CACHE_DIR"] ?? join(process.cwd(), "data", "cache", "query-expand");

const MAX_QUERIES = parseInt(process.env["QUERY_EXPAND_MAX"] ?? "5", 10);

function fingerprintInterest(interest: InterestShape): string {
  const raw = `${interest.topic}|${interest.description ?? ""}|${interest.searchKeywords.join(",")}`;
  let h = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

async function readCache(interestId: string, fp: string): Promise<string[] | null> {
  try {
    const path = join(CACHE_ROOT, `${interestId}_${todayUtc()}_${fp}.json`);
    const raw = await readFile(path, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  } catch {
    return null;
  }
}

async function writeCache(interestId: string, fp: string, queries: string[]): Promise<void> {
  await mkdir(CACHE_ROOT, { recursive: true });
  const path = join(CACHE_ROOT, `${interestId}_${todayUtc()}_${fp}.json`);
  await writeFile(path, JSON.stringify(queries, null, 2), "utf-8");
}

function fallbackQueries(interest: InterestShape): string[] {
  const kw = interest.searchKeywords.slice(0, 8).join(" ");
  const desc = interest.description?.trim()
    ? truncateForSearchQuery(interest.description.trim(), 140)
    : "";
  const base = [interest.topic, `${interest.topic} news`, `${interest.topic} ${kw}`.trim()];
  if (desc) base.push(`${interest.topic} ${desc}`, desc);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const q of base) {
    const t = q.trim();
    if (t.length < 3 || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
    if (out.length >= MAX_QUERIES) break;
  }
  return out;
}

export async function expandQueries(interest: InterestShape): Promise<string[]> {
  const fp = fingerprintInterest(interest);
  const cached = await readCache(interest.id, fp);
  if (cached && cached.length > 0) return cached.slice(0, MAX_QUERIES);

  let queries: string[] = [];

  try {
    const sys =
      "You produce concise web news search queries tailored to what the user cares about. Reply ONLY with valid JSON object with key \"queries\" whose value is an array of 3-5 strings. No markdown.";
    const user = [
      `Interest topic (short label): ${interest.topic}`,
      interest.description?.trim()
        ? [
            "User description — treat as the PRIMARY constraint:",
            interest.description.trim(),
            "",
            "Every query must reflect this focus (angles, geography, sector, products, people, or exclusions). Do not emit generic topic-only queries that ignore the description.",
          ].join("\n")
        : "",
      interest.searchKeywords?.length
        ? `Additional keywords (use when helpful): ${interest.searchKeywords.join(", ")}`
        : "",
      "",
      "Generate diverse queries for RSS/news search: developments, policy, companies, research — vary wording; avoid near-duplicates.",
    ]
      .filter(Boolean)
      .join("\n");

    const res = await chatCompletion(getQueryExpandModel(), [
      { role: "system", content: sys },
      { role: "user", content: user },
    ], { temperature: 0.4, maxTokens: 512, responseFormat: { type: "json_object" } });

    const parsed = JSON.parse(res.content) as unknown;
    let arr: unknown = null;
    if (Array.isArray(parsed)) arr = parsed;
    else if (parsed && typeof parsed === "object" && "queries" in parsed) {
      arr = (parsed as { queries: unknown }).queries;
    }

    if (Array.isArray(arr)) {
      queries = arr
        .filter((x): x is string => typeof x === "string")
        .map((s) => s.trim())
        .filter((s) => s.length > 2)
        .slice(0, MAX_QUERIES);
    }
  } catch (err) {
    console.warn(`[scout] query-expand LLM failed: ${(err as Error).message}`);
  }

  if (queries.length < 3) {
    queries = [...new Set([...queries, ...fallbackQueries(interest)])].slice(0, MAX_QUERIES);
  }

  await writeCache(interest.id, fp, queries).catch(() => {});
  return queries;
}
