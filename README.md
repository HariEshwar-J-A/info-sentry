# Info-Sentry

Personal news and GitHub intelligence system. Continuously scouts the web, analyses content with AI, generates predictions, and surfaces everything through a web feed and Telegram supergroup.

---

## What it does

- **News feed** — scrapes RSS feeds, sitemaps and web pages; summarises articles with LLM; posts to Telegram
- **GitHub feed** — discovers trending repositories per topic; generates detailed AI analysis from READMEs; posts to Telegram GitHub-Feed thread
- **Predictions** — AI-generated event predictions from summarised articles; tracks outcomes
- **Topics** — define interests with keywords; auto-discover relevant sources; one-click pipeline seed
- **Sources** — full CRUD with reliability scoring; News / GitHub filter; auto-discovery via DuckDuckGo + Google News
- **Budget-aware** — 4-tier model selection stays within a configurable monthly USD cap

---

## Quick start

```bash
# 1. Install
git clone <repo> info-sentry && cd info-sentry
make setup

# 2. Configure
cp .env.example .env   # fill in DATABASE_URL, OPENROUTER_API_KEY, Telegram vars

# 3. Create database tables
make db-migrate

# If migrate fails with "must be owner of table …", see **Database migrations** below.

# 4. (Optional) Create Telegram forum topics
make db-topics

# 5. Start everything
make dev        # foreground — Ctrl+C stops everything cleanly
# or
make start      # background — logs go to logs/
make stop       # stop background services
make status     # check what's running
```

See [`docs/setup.md`](docs/setup.md) for full configuration details.

---

## Database migrations

Prisma applies migrations using **`DATABASE_URL`**. In Docker, tables are often **owned by `infosentry`** while `.env` may use **`openclaw_role`**, which has grants but may **not** own tables. PostgreSQL then returns **`must be owner of table …`** on `ALTER TABLE`.

**Options:**

1. Run migrate as the DB owner (swap user/password in the URL — see `.env` `POSTGRES_USER` / `POSTGRES_PASSWORD`):

   ```bash
   DATABASE_URL="postgresql://infosentry:<password>@127.0.0.1:5432/infosentry" npx prisma migrate deploy
   ```

2. Apply the migration SQL as owner (e.g. `docker exec -i infosentry-db psql -U infosentry -d infosentry < prisma/migrations/<name>/migration.sql`), then record it:

   ```bash
   npx prisma migrate resolve --applied "<migration_name>"
   ```

3. If a migration failed mid-run: `npx prisma migrate resolve --rolled-back "<migration_name>"` before retrying.

Longer notes: [`MEMORY.md`](MEMORY.md). Agent-oriented rules: [`.cursor/rules/`](.cursor/rules/), [`.claude/`](.claude/).

---

## Commands

```
make dev          Start all services in foreground (Ctrl+C kills everything)
make start        Start all services in the background
make stop         Stop all background services
make restart      Stop then start all services
make status       Show service status + port availability
make logs         Tail all background service logs

make pipeline     Run full news pipeline (scout → analyst → predictor)
make scout        News scout only
make github       GitHub scout + analyst for all topics
make health       System health check
make budget       LLM spend report
make bot          Start Telegram bot in foreground

make db-generate  Regenerate Prisma client after schema changes
make db-migrate   Apply pending schema migrations
make db-topics    Ensure Telegram forum topics exist in supergroup
```

---

## Services

| Service | Port | Purpose |
|---|---|---|
| OpenClaw gateway | 18790 | Agent runtime (Manager, Scout, Analyst, Prediction, Feedback, Coder) |
| Next.js web | 3001 | Web UI and REST API |
| Telegram bot | — | User commands, inline button callbacks, notifications |

---

## Web pages

| Page | URL |
|---|---|
| News feed | `/feed` |
| GitHub feed | `/github-feed` |
| Repo detail | `/github-feed/[id]` |
| Topics & sources | `/topics` |
| Source management | `/sources` |
| Predictions | `/predictions` |
| Settings | `/settings` |

---

## Telegram topics

| Thread | Content |
|---|---|
| Main-News | Summarised articles with like/dislike buttons |
| Predictions | AI event predictions with track/dismiss buttons |
| GitHub-Feed | Trending repos with star delta + AI analysis |
| Feedback | User feedback and admin replies |
| System-Log | Health and pipeline status updates |

---

## Stack

- **Runtime** — Node.js 20+, TypeScript, tsx
- **Web** — Next.js 15 (App Router)
- **Database** — PostgreSQL + Prisma 6
- **Vector store** — ChromaDB (article embeddings)
- **AI** — OpenRouter (Gemini 2.0 Flash, DeepSeek R1, Kimi K2.6, GPT-4o Mini)
- **Agents** — OpenClaw (6 agents)
- **Notifications** — Telegram Bot API (supergroup + forum topics)

---

## Docs

| | |
|---|---|
| [`MEMORY.md`](MEMORY.md) | Long-term memory, Postgres/Prisma gotchas, web auth notes |
| [`CLAUDE.md`](CLAUDE.md) / [`.claude/CLAUDE.md`](.claude/CLAUDE.md) | AI agent instructions (migrations, multi-user) |
| [`docs/setup.md`](docs/setup.md) | Installation and configuration |
| [`docs/architecture.md`](docs/architecture.md) | System design and data flow |
| [`docs/scripts-ref.md`](docs/scripts-ref.md) | All scripts reference |
| [`REPO_INDEX.md`](REPO_INDEX.md) | Complete file map |
| [`agents/*/SOUL.md`](agents/) | Agent system prompts |
