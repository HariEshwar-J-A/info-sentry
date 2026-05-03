#!/usr/bin/env tsx
/**
 * github-analyst.ts — Generate AI summaries for GitHub repos that have a README.
 *
 * Usage:
 *   npx tsx scripts/github-analyst.ts                     # all repos without summary
 *   npx tsx scripts/github-analyst.ts --interestId=<id>  # one topic's repos
 *   npx tsx scripts/github-analyst.ts --limit=20          # max repos to process
 */
import "dotenv/config";
import { getScoutDb, disconnectAll } from "./lib/prisma.js";
import { chatCompletion } from "./lib/openrouter.js";
import { logCost, canSpend, getMonthlySpend } from "./lib/budget.js";
import { getModelsForCurrentBudget } from "./lib/models.js";

const SYSTEM_PROMPT = `You are analyzing a GitHub repository for a tech professional.
Read the README and produce a concise 2-3 sentence summary covering:
1. What this tool/library does (be specific, no vague descriptions)
2. The primary use case or problem it solves
3. One notable technical aspect or why it stands out

Rules:
- Be factual and precise — no marketing language
- Focus on what a developer needs to know
- If the README is minimal, summarize from what's available
- Output plain text, no markdown, no bullet points`

async function main() {
  const args = Object.fromEntries(
    process.argv.slice(2).map(a => a.replace(/^--/, "").split("="))
  ) as { interestId?: string; limit?: string }

  const limit = parseInt(args.limit ?? "30", 10)
  const db = getScoutDb()

  if (!(await canSpend("github-analyst"))) {
    console.log("[github-analyst] Budget exceeded — skipping")
    await disconnectAll()
    return
  }

  const models = await getModelsForCurrentBudget(getMonthlySpend)
  const model = models.ANALYST
  console.log(`[github-analyst] Using model: ${model.name}`)

  const where = {
    aiSummary: null,
    readme: { not: null },
    ...(args.interestId ? { interestId: args.interestId } : {}),
  }

  const repos = await db.gitHubRepo.findMany({
    where,
    orderBy: { stars: "desc" },
    take: limit,
    select: { id: true, fullName: true, description: true, readme: true, stars: true, language: true, topics: true },
  })

  console.log(`[github-analyst] ${repos.length} repos to summarize`)

  let processed = 0
  for (const repo of repos) {
    try {
      const readmeSnippet = repo.readme?.slice(0, 4000) ?? ""
      const context = [
        `Repository: ${repo.fullName}`,
        repo.description ? `Description: ${repo.description}` : "",
        repo.language ? `Primary language: ${repo.language}` : "",
        repo.topics.length > 0 ? `Topics: ${repo.topics.join(", ")}` : "",
        `Stars: ${repo.stars.toLocaleString()}`,
        "",
        "README:",
        readmeSnippet,
      ].filter(Boolean).join("\n")

      const response = await chatCompletion(
        model.id,
        [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: context },
        ],
        { temperature: 0.3, maxTokens: 250 },
      )

      await db.gitHubRepo.update({
        where: { id: repo.id },
        data: { aiSummary: response.content.trim() },
      })

      await logCost("github-analyst", model, response.promptTokens, response.completionTokens, response.generationId)
      processed++
      console.log(`[github-analyst] ✓ ${repo.fullName} (${repo.stars.toLocaleString()} ⭐)`)
    } catch (err) {
      console.error(`[github-analyst] ✗ ${repo.fullName}: ${(err as Error).message}`)
    }
  }

  console.log(`[github-analyst] Done: ${processed}/${repos.length} summaries generated`)
  await disconnectAll()
}

main().catch(err => {
  console.error("[github-analyst] Fatal:", err)
  process.exit(1)
})
