# Setup Guide

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | ≥ 20 | `node --version` |
| PostgreSQL | ≥ 15 | Running locally or remote |
| OpenClaw | latest | `npm install -g openclaw` |
| Playwright | bundled | Installed via `npm install` |

## 1. Clone and install

```bash
git clone <repo-url> info-sentry
cd info-sentry
make setup          # npm install + prisma generate
```

## 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/infosentry"

# AI — get a key at openrouter.ai
OPENROUTER_API_KEY="sk-or-..."

# Telegram — optional, enables notifications and bot commands
TELEGRAM_BOT_TOKEN="..."
TELEGRAM_ADMIN_ID="..."          # your Telegram user ID
TELEGRAM_SUPERGROUP_ID="..."     # your supergroup chat ID (negative number)

# ChromaDB — runs locally, no key needed by default
CHROMA_URL="http://localhost:8000"

# Scout v3 — Next.js spawns scripts from web/; mirror these if pipeline runs from `npm run dev` in web/
SCRAPEGRAPH_URL="http://127.0.0.1:8811"
QUERY_EXPAND_MODEL="google/gemini-2.0-flash-001"
SGAI_MODEL="google/gemini-2.0-flash-001"

# Budget limits (USD/month)
MONTHLY_BUDGET_USD="7.30"
DAILY_BUDGET_USD="0.24"
```

## 3. Set up the database

```bash
make db-migrate     # create tables
make db-seed        # seed initial interests and sources (optional)
```

## 4. Set up Telegram topics (optional)

If you have a Telegram supergroup configured:

```bash
make db-topics      # creates Main-News, Predictions, GitHub-Feed, etc.
```

## 5. Scout v3 + ScrapeGraph sidecar

After `make db-up` (or `docker compose up -d`), Postgres, ChromaDB, and the **ScrapeGraph** sidecar start. Scout (`npm run scout`, cron, web pipeline, Telegram `/run`) calls `http://127.0.0.1:8811` for LLM-assisted extraction.

- **Cheap defaults**: `QUERY_EXPAND_MODEL` and `SGAI_MODEL` default to **`google/gemini-2.0-flash-001`** (OpenRouter). Override in `.env`.
- **Web UI pipelines**: if you run Next.js only from `web/`, add `SCRAPEGRAPH_URL`, `OPENROUTER_API_KEY`, and model vars to `web/.env.local` so spawned scripts inherit them.

First-time sidecar build: `docker compose build scrapegraph` (can take several minutes).

## 6. Start everything

```bash
make dev            # foreground — Ctrl+C stops all services
# or
make start          # background — logs go to logs/
make stop           # stop background services
```

## 7. Web interface

Open [http://localhost:3001](http://localhost:3001) after starting.

## 8. Running the pipeline manually

```bash
make pipeline       # scout → analyst → predictor (all topics)
make scout          # scout only
make github         # GitHub scout + analyst
make health         # health check
make budget         # budget report
```
