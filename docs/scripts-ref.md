# Scripts Reference

All scripts live in `scripts/` and are run via `npx tsx scripts/<name>.ts`.
Most have convenience aliases in `package.json` and `Makefile`.

## Pipeline

| Script | Alias | Description |
|---|---|---|
| `pipeline-run.ts` | `npm run pipeline` | Scout → Analyst → Predictor for all topics |
| `scout-run.ts` | `npm run scout` | Scrape news sources (RSS + web crawl) |
| `analyst-run.ts` | — | Analyse SCRAPED articles, post to Telegram Main-News |
| `predictor-run.ts` | — | Generate predictions from SUMMARIZED articles |
| `github-scout.ts` | `npm run github:scan` | Discover trending GitHub repos per topic |
| `github-analyst.ts` | (part of github:scan) | Summarise repos, post to Telegram GitHub-Feed |
| `source-discovery.ts` | — | Auto-discover new news sources per topic |

## Agents (via analyst/predictor scripts)

| Script | Description |
|---|---|
| `analyst-process.ts` | Single-article analysis (called by analyst-run) |
| `prediction-process.ts` | Single-article prediction (called by predictor-run) |
| `prediction-verifier.ts` | Verify tracked predictions against outcomes |

## Telegram

| Script | Alias | Description |
|---|---|---|
| `telegram-bot.ts` | `npm run bot` | Long-poll bot for user commands + callbacks |
| `telegram-send.ts` | — | Send a message to a topic or admin DM |
| `telegram-callback.ts` | — | Handle inline keyboard callbacks |

## Database

| Script | Alias | Description |
|---|---|---|
| `db-query.ts` | `npm run db` | Query/mutate DB from the CLI |
| `check-articles.ts` | — | Report article status breakdown |
| `reset-failed.ts` | — | Reset FAILED articles back to SCRAPED |
| `check-sources.ts` | — | Audit source health |

## Monitoring

| Script | Alias | Description |
|---|---|---|
| `health-check.ts` | `npm run health` | Overall system health report |
| `budget-check.ts` | `npm run budget` | LLM spend vs. budget |
| `system-log-post.ts` | — | Post system status to Telegram System-Log |

## Library (`scripts/lib/`)

| File | Purpose |
|---|---|
| `prisma.ts` | Shared Prisma client (singleton) |
| `openrouter.ts` | OpenRouter API wrapper + LLMResponse type |
| `models.ts` | Model config, budget tiers, SUMMARIZER role |
| `budget.ts` | canSpend(), logCost(), getMonthlySpend() |
| `agents.ts` | REPO_ROOT constant, agent path helpers |
