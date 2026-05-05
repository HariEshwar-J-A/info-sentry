# Info-Sentry — Repository Index

**Version:** 0.3.1 · **Updated:** 2026-05-05

---

## Root

```
info-sentry/
├── Makefile                  ← all common commands (make dev / start / stop / …)
├── README.md                 ← project overview and quick start
├── REPO_INDEX.md             ← this file
├── package.json              ← root scripts + devDependencies
├── tsconfig.json             ← TypeScript config for scripts/
├── openclaw.json             ← OpenClaw profile config
├── docker-compose.yml        ← optional: PostgreSQL + ChromaDB via Docker
├── .env.example              ← required env vars template
└── prisma/
    └── schema.prisma         ← 20-model DB schema
```

## docs/

Supplemental documentation (not runtime):

```
docs/
├── architecture.md           ← system design, data flow, model tiers
├── setup.md                  ← installation and configuration guide
├── scripts-ref.md            ← every script and what it does
└── skill-upgrade-summary.md  ← historical agent upgrade notes
```

## agents/

OpenClaw agent definitions. Each folder = one agent loaded by the gateway.

```
agents/
├── analyst/SOUL.md           ← article analysis (LLM summarisation)
├── coder/SOUL.md             ← code generation and debugging tasks
├── feedback/SOUL.md          ← Telegram feedback thread handler
├── manager/SOUL.md           ← system governance, cron, budget
├── prediction/SOUL.md        ← event prediction generation
└── scout/SOUL.md             ← web scraping coordination
```

## scripts/

All executable TypeScript utilities.

### Pipeline

| File | What it does |
|---|---|
| `pipeline-run.ts` | Thin orchestrator: analyst-run → predictor-run |
| `scout-run.ts` | Phase 1: Google News RSS per topic; Phase 2: manual sources (RSS fallback) |
| `analyst-run.ts` | SCRAPED → SUMMARIZED; posts to Telegram Main-News |
| `analyst-process.ts` | Single-article analysis subprocess |
| `predictor-run.ts` | SUMMARIZED → POSTED; posts to Telegram Predictions |
| `prediction-process.ts` | Single-article prediction subprocess |
| `prediction-verifier.ts` | Verify tracked predictions against outcomes |

### GitHub

| File | What it does |
|---|---|
| `github-scout.ts` | Search GitHub API per topic; upsert GitHubRepo + Source records |
| `github-analyst.ts` | Phase 0: clear stale summaries; Phase 1: summarise READMEs; Phase 2: post to GitHub-Feed |
| `source-discovery.ts` | Auto-discover news sources via Google News + DuckDuckGo |

### Telegram

| File | What it does |
|---|---|
| `telegram-bot.ts` | Long-poll bot — admin commands, pipeline trigger, help |
| `telegram-send.ts` | CLI: send to a topic thread or admin DM |
| `telegram-callback.ts` | Inline keyboard callback dispatcher |

### Database & tooling

| File | What it does |
|---|---|
| `db-query.ts` | CLI for DB operations (`npm run db <resource> <action>`) |
| `reset-failed.ts` | Reset FAILED articles → SCRAPED for retry |
| `check-articles.ts` | Article status breakdown report |
| `check-sources.ts` | Source health audit |
| `health-check.ts` | Full system health report |
| `budget-check.ts` | LLM spend vs. budget |
| `system-log-post.ts` | Post status update to Telegram System-Log |

### lib/

Shared library imported by scripts.

| File | Purpose |
|---|---|
| `prisma.ts` | Singleton PrismaClient (one connection for all scripts) |
| `openrouter.ts` | chatCompletion() wrapper, LLMResponse type |
| `models.ts` | ModelConfig, budget tiers 1–4, SUMMARIZER role |
| `budget.ts` | canSpend(), logCost(), getMonthlySpend() |

### Service management

| File | What it does |
|---|---|
| `scripts/manage.sh` | `start` / `stop` / `restart` / `status` / `dev` |

## web/

Next.js 15 (App Router) frontend.

### Pages (`web/src/app/`)

| Route | Page |
|---|---|
| `/feed` | News feed — search, 48h filter, unread count, article cards |
| `/github-feed` | GitHub feed — language/topic filters, trending sort, repo cards |
| `/github-feed/[id]` | Repo detail — full AI analysis, README, stats |
| `/topics` | Topic management — seed pipeline, GitHub scan, source discovery |
| `/sources` | Source management — CRUD, trust scores, News/GitHub filter tabs |
| `/predictions` | Predictions — all/tracked tabs, verify button |
| `/settings` | Agent config, model overrides, pipeline run controls |
| `/article/[id]` | Single article view with AI chat |
| `/chat` | Multi-session AI chat interface |

### API routes (`web/src/app/api/`)

| Route | Methods | Purpose |
|---|---|---|
| `/api/feed` | GET | Articles with filters (sort, hours, search) |
| `/api/github` | GET | GitHub repos with filters (sort, language, topic) |
| `/api/github/[id]` | GET, POST | Single repo detail; mark viewed |
| `/api/interests` | GET, POST | List/create topics |
| `/api/interests/[id]` | PATCH, DELETE | Update/remove topic |
| `/api/interests/[id]/sources` | GET, POST | Topic's source list; add source |
| `/api/interests/[id]/sources/[sid]` | DELETE | Unlink source from topic |
| `/api/interests/[id]/discover` | POST (SSE) | Auto-discover sources |
| `/api/interests/[id]/github-scan` | POST (SSE) | GitHub scout + analyst pipeline |
| `/api/interests/seed` | POST (SSE) | Full pipeline seed |
| `/api/sources` | GET | All sources with article counts |
| `/api/sources/[id]` | PATCH | Edit source (name, rssUrl, trustScore, isActive) |
| `/api/predictions` | GET | All predictions |
| `/api/predictions/all` | GET | All predictions (no filter) |
| `/api/predictions/stats` | GET | Prediction stats |
| `/api/pipeline/run` | POST (SSE) | Manual pipeline trigger |
| `/api/budget` | GET | Budget status |

### Key components (`web/src/components/`)

| Component | Purpose |
|---|---|
| `shell/Sidebar` | Navigation, notification bell, sound alerts |
| `shell/TopBar` | Page header with title/subtitle/actions slot |
| `shell/SourceTypeToggle` | News ↔ GitHub feed switcher |
| `github/RepoCard` | Repo card in the GitHub feed grid |
| `feed/FeedClient` | News feed with search, filters, refresh |
| `topics/TopicCluster` | Topic cluster view |

## prisma/schema.prisma — Models

| Model | Purpose |
|---|---|
| `User` | Single owner user |
| `Interest` | Tracked topics with keywords |
| `Source` | News/GitHub/RSS sources (types: WEB, RSS, API, GITHUB) |
| `InterestSource` | Many-to-many: interests ↔ sources |
| `Article` | Scraped articles (SCRAPED → ANALYZING → SUMMARIZED → POSTED / FAILED) |
| `Summary` | LLM-generated article summaries |
| `Prediction` | AI-generated event predictions |
| `ArticleInsight` | Per-article analysis metadata |
| `WebChatSession` | Browser chat sessions |
| `WebChatMessage` | Chat message history |
| `MediaContent` | Multimedia attachments |
| `ValidationQueue` | Prediction validation items |
| `PredictionOutcome` | Verified prediction results |
| `ChatMessage` | Agent chat history |
| `AgentConfig` | Per-agent config (isActive, lastRunAt) |
| `CostLog` | LLM call cost tracking |
| `BudgetStatus` | Monthly budget snapshots |
| `Notification` | In-app notification records |
| `ForumTopic` | Telegram forum topic thread IDs |
| `GitHubRepo` | Discovered GitHub repos with star history + AI summary |

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✓ | PostgreSQL connection string |
| `OPENROUTER_API_KEY` | ✓ | API key for LLM calls |
| `TELEGRAM_BOT_TOKEN` | optional | Enables bot + notifications |
| `TELEGRAM_ADMIN_ID` | optional | Your Telegram user ID |
| `TELEGRAM_SUPERGROUP_ID` | optional | Supergroup chat ID (negative number) |
| `CHROMA_URL` | optional | ChromaDB URL (default: http://localhost:8000) |
| `MONTHLY_BUDGET_USD` | optional | Monthly LLM cap (default: 7.30) |
| `DAILY_BUDGET_USD` | optional | Daily soft limit (default: 0.24) |
| `GITHUB_TOKEN` | optional | GitHub PAT for 30 req/min (vs 10 unauthenticated) |
