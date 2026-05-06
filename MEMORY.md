# MEMORY.md - Long-Term Memory

## Info-Sentry Project

Created: 2026-05-03
Workspace: /Users/harieshwar-ai/Documents/code/info-sentry

## Project Overview

Info-Sentry is a personal news intelligence system powered by 6 AI agents running on OpenClaw. It scrapes news sources based on user interests, analyzes articles with LLMs, generates forward-looking predictions, and delivers everything to a Telegram supergroup with interactive feedback buttons.

### Architecture
- **Gateway**: OpenClaw slave gateway on port 18790
- **Agents**: coder (Kimi K2.6), manager (DeepSeek V3.2), feedback (DeepSeek V3.2), scout (Gemini Flash Lite), analyst (DeepSeek V3.2), prediction (DeepSeek V3.2)
- **Database**: PostgreSQL with Prisma ORM
- **Vector store**: ChromaDB (local instance)
- **Budget**: 10 CAD/month (~7.30 USD)

### Status Observations
- System is healthy as of 2026-05-03
- All agents active, no errors
- PostgreSQL running, ChromaDB enabled
- Budget within limits (~0.72 USD spent, 9.9% of monthly budget)
- Telegram bot running
- Cron jobs have schedule errors and are idle

### Issues to Resolve
1. Cron job schedule errors need fixing in openclaw.json or cron/jobs.json
2. File permissions issues (root owns some files)

## Learning Notes

### Heartbeat Pattern
- HEARTBEAT.md is empty, so no proactive checks configured
- Heartbeat polls every ~30 minutes
- Need to consider adding periodic checks for system health, budget alerts, pending articles

### System Monitoring
- Regular health checks show agents active
- Budget monitoring shows good control
- Pending articles fluctuate (0-6)

## Important Decisions

None yet recorded.

---

## Scout v3 — ScrapeGraphAI multi-source pipeline (2026-05)

- **`scripts/scout-run.ts`** orchestrates discovery (Google News + Bing News + Hacker News + Reddit), LLM query expansion (`scripts/lib/query-expand.ts`), Google News URL resolution, Cheerio fetch, then **`SmartScraperGraph`** via a Python sidecar when content is shorter than `SGAI_MIN_CONTENT_LEN` (default 400 chars).
- **Sidecar**: [`services/scrapegraph/`](services/scrapegraph/) — `docker compose up -d scrapegraph` publishes **`127.0.0.1:8811`**. Uses **`OPENROUTER_API_KEY`** + **`SGAI_MODEL`** via LangChain **`ChatOpenAI`** (`model_instance`) pointing at OpenRouter’s OpenAI-compatible **`base_url`** (required because ScrapeGraph splits `provider/model` on `/` and does not support raw `google/...` strings). Default: **`google/gemini-2.0-flash-001`** (see [`scripts/lib/scout-llm-defaults.ts`](scripts/lib/scout-llm-defaults.ts)). Telemetry off: `SCRAPEGRAPHAI_TELEMETRY_ENABLED=false`.
- **`make db-up` / `cmd_db_up`**: waits for ScrapeGraph `/health` (best-effort) so cron/Telegram/web runs see the sidecar after stack start.
- **`SCRAPEGRAPH_URL`**: Scout on the **host** → `http://127.0.0.1:8811`. Scout in **`Dockerfile.scout`** container → default `http://host.docker.internal:8811` (Docker Desktop); on Linux Docker add `--add-host=host.docker.internal:host-gateway` or join the compose network and set `http://scrapegraph:8811`.
- **Budget guard**: **`SGAI_MAX_CALLS_PER_RUN`** (default 30) counts every `/smart-scrape` and `/search-scrape` invocation; after the cap, scout falls back to RSS/snippet-only saves for remaining candidates.
- **Legacy DB rows**: Sources named `Google News: …` are skipped in Phase 2 manual scraping; Phase 1 uses **`News pipeline: …`** as the synthetic source name.

---

## PostgreSQL / Prisma (critical for migrations)

- **`DATABASE_URL` uses `openclaw_role`**, but Docker Postgres tables from initial Prisma migrations are often **owned by `infosentry`** (`POSTGRES_USER`). Only the table owner can `ALTER TABLE`.
- **`npx prisma migrate deploy`** (and `make db-migrate` → `npm run db:migrate`) may fail with **`must be owner of table User`** (or another table). This is an ownership mismatch, not a broken migration file.
- **Ways to fix:**
  1. Run migrations as the owner, e.g.  
     `DATABASE_URL="postgresql://infosentry:${POSTGRES_PASSWORD}@127.0.0.1:5432/infosentry" npx prisma migrate deploy`
  2. Apply the SQL as owner (`docker exec … psql -U infosentry … -f migration.sql`), then  
     `npx prisma migrate resolve --applied "<migration_name>"`
  3. Optionally change ownership so `openclaw_role` owns app tables (one-time, as superuser):  
     `ALTER TABLE public."User" OWNER TO openclaw_role;` (repeat for other tables as needed; understand security implications).
- After a failed attempt, Prisma may list the migration as failed; use  
  `prisma migrate resolve --rolled-back "<name>"` before retrying if the DB was not changed.

## Web auth / multi-user

- Google OAuth creates/updates **`User`** rows by **`googleSub`**; session cookie carries **`User.id`**; middleware forwards **`x-user-id`** to API routes.
- **Do not** use a shared `OWNER_USER_ID` env for user-scoped data; scope queries with the authenticated user id from the request.
- Same shared DB hosts all users; isolation is by **`userId`** on user-owned models (interests, notifications, web chat sessions, etc.).

---

## Where agents should look

| Location | Purpose |
|----------|---------|
| [README.md](README.md) | Setup, commands, DB migration notes |
| This file | Long-term project memory and gotchas |
| [CLAUDE.md](CLAUDE.md) | Points to `.claude/CLAUDE.md` for tools that read the repo root |
| [.cursor/rules/](.cursor/rules/) | Cursor repo rules (Prisma/Postgres, conventions) |
| [.claude/CLAUDE.md](.claude/CLAUDE.md) | Claude / agent brief (mirrors key repo rules) |