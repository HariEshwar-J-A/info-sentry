/**
 * Build search and extraction prompts from the user's topic + description + keywords.
 * Keeps scout/scraper aligned with what the user actually said they care about.
 */

export interface InterestFocus {
  topic: string;
  description: string | null;
  searchKeywords: string[];
}

export function truncateForSearchQuery(text: string, maxChars: number): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length <= maxChars) return t;
  const cut = t.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}

/** Primary Google News / pipeline query: topic + keywords + description (URL-safe length cap). */
export function buildInterestSearchQuery(interest: InterestFocus, maxTotalChars = 450): string {
  const parts: string[] = [interest.topic.trim()];
  const topicLower = interest.topic.toLowerCase();

  for (const k of interest.searchKeywords) {
    const kk = k.trim();
    if (!kk || topicLower.includes(kk.toLowerCase())) continue;
    parts.push(kk);
  }

  if (interest.description?.trim()) {
    parts.push(truncateForSearchQuery(interest.description, 320));
  }

  let q = parts.join(" ").replace(/\s+/g, " ").trim();
  if (q.length > maxTotalChars) q = truncateForSearchQuery(q, maxTotalChars);
  return q;
}

/** SmartScraperGraph: steer extraction toward reader interests (one or many trackers per source). */
export function buildSmartScrapePromptForInterests(focuses: InterestFocus[]): string {
  const blocks = focuses.map((f, i) => {
    const lines: string[] = [`${i + 1}. Topic: ${f.topic.trim()}`];
    if (f.description?.trim()) {
      lines.push(`   User focus (prioritize text relevant to this): ${truncateForSearchQuery(f.description.trim(), 520)}`);
    }
    if (f.searchKeywords?.length) {
      lines.push(`   Keywords: ${f.searchKeywords.slice(0, 14).join(", ")}`);
    }
    return lines.join("\n");
  });

  return `The reader tracks these interests — extract the article body and summary in light of these angles (skip ads, nav, comment fluff unrelated to the story):

${blocks.join("\n\n")}

Extract from this page:
1. The canonical article or page title.
2. The main author or byline if visible.
3. The publication or update date if visible (ISO 8601 if possible).
4. The full main text content as clean plain text (paragraphs separated by blank lines). Prefer sentences that relate to the user's focus above when the article covers multiple subjects.
5. A one-sentence summary explaining why this piece matters for those interests.

Respond as JSON with keys: title (string), author (string or null), published_at (string or null),
content (string), summary (string).`;
}

/** SearchGraph sidecar: topic string + detailed prompt grounded in description. */
export function buildSearchGraphTopicAndPrompt(interest: InterestFocus): { topic: string; prompt: string } {
  const desc = interest.description?.trim();
  const topic = desc ? `${interest.topic.trim()} — ${truncateForSearchQuery(desc, 220)}` : interest.topic.trim();

  const promptLines = [
    `Find recent credible news URLs that fit this tracked interest.`,
    ``,
    `Topic label: ${interest.topic.trim()}`,
    desc ? `User's stated focus — candidates MUST align with this (not just the topic name in isolation):\n${desc}` : "",
    interest.searchKeywords?.length
      ? `Related angles / entities to prefer when relevant: ${interest.searchKeywords.join(", ")}.`
      : "",
    ``,
    `Prefer primary reporting and official sources. If the topic label is ambiguous, use the user's focus to disambiguate.`,
    `Exclude results that only mention the topic in passing if they contradict or ignore the user's stated focus.`,
  ];

  return {
    topic,
    prompt: promptLines.filter((l) => l !== "").join("\n"),
  };
}

/** Dedupe multiple InterestFocus rows (e.g. several interests linked to one RSS source). */
export function dedupeInterestFocuses(focuses: InterestFocus[]): InterestFocus[] {
  const seen = new Set<string>();
  const out: InterestFocus[] = [];
  for (const f of focuses) {
    const key = `${f.topic.trim().toLowerCase()}|${(f.description ?? "").trim()}|${f.searchKeywords.join(",")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}
