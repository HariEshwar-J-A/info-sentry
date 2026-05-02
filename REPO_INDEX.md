# Info-Sentry — Complete Repository Index

**Purpose:** Personal news intelligence system powered by 5 AI agents running on OpenClaw.  
**Version:** 0.3.0  
**Last Updated:** 2026-04-30

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [System Components](#2-system-components)
3. [Database Schema](#3-database-schema)
4. [Agent System](#4-agent-system)
5. [Pipeline Flow](#5-pipeline-flow)
6. [Scripts Reference](#6-scripts-reference)
7. [Configuration](#7-configuration)
8. [Skills & Extensions](#8-skills--extensions)
9. [Development Workflow](#9-development-workflow)
10. [Commands Quick Reference](#10-commands-quick-reference)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         OpenClaw Runtime                                 │
│                    (Gateway on 127.0.0.1:18789)                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┴────────────────────────────┐
        │                                                        │
   ┌────▼─────┐                                           ┌──────▼──────┐
   │  Manager │←───────────────────┐                      │  Feedback   │
   │   Agent  │   (Private DM)     │                      │    Agent    │←──┐
   │  (cron)  │                    │                      │  (supergroup)│   │
   └────┬─────┘                    │                      └──────┬──────┘   │
        │                          │                             │          │
        │                          │                      User     │          │
        │                          │                      Replies  │          │
        │                          └───────────────────────────────┘          │
        │                                                                     │
        │     ┌───────────────────────────────────────────────────────────────┘
        │     │
        │     ▼
   ┌────▼─────▼──────┐    ┌──────────────┐    ┌──────────────────┐
   │   Cron Jobs     │    │   Database   │    │    ChromaDB      │
   │                 │    │              │    │                  │
   │ • scout-scrape  │◄──►│  PostgreSQL  │◄──►│  Embeddings      │
   │ • pipeline-proc │    │              │    │  Collections     │
   │ • health-check  │    └──────────────┘    └──────────────────┘
   │ • budget-check  │
   └────┬────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                            Scripts                                      │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐│
│  │ scout-run.ts │  │pipeline-run. │  │analyst-proc. │  │predict-proc. ││
│  │              │  │    ts        │  │    ts        │  │    ts        ││
│  │ • Crawlee    │  │ • Orchestrate│  │ • LLM analyze│  │ • LLM predict││
│  │ • Cheerio    │  │ • ChromaDB   │  │ • Summarize  │  │ • Forecast   ││
│  │ • Playwright │  │ • Telegram   │  │ • Topics     │  │ • Confidence ││
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
INTERESTS → SOURCES → SCRAPE → SAVE → ANALYZE → PREDICT → POST → TELEGRAM
    ↓          ↓         ↓       ↓        ↓         ↓       ↓
  "AI"      "TechCrunch"  Crawl  .md    DeepSeek  DeepSeek  Forum
  "Crypto"  "ArXiv"       HTML   JSON   Summary   Forecast  Topics
  "Biotech" "Reuters"           Chroma                    + Buttons
```

---

## 2. System Components

### 2.1 Database (PostgreSQL)

**Connection URLs:**
- Full: `DATABASE_URL` → `postgresql://openclaw_role:...`
- Scout (restricted): `SCOUT_DATABASE_URL` → `postgresql://scout_role:...`

**Key Tables:**

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `User` | Telegram users | `telegramId`, `username`, `isAdmin` |
| `Interest` | Topics to track | `topic`, `description`, `score`, `isActive` |
| `Source` | News sources | `name`, `url`, `type`, `crawlMethod`, `rssUrl` |
| `Article` | Scraped content | `url`, `title`, `rawFilePath`, `status` |
| `Summary` | LLM analysis | `content`, `keyTopics`, `sentimentScore` |
| `Prediction` | Forecasts | `content`, `confidence`, `timeHorizon` |
| `MediaContent` | Video/audio | `type`, `url`, `transcript` |
| `AgentConfig` | Agent status | `agentName`, `isActive`, `cronSchedule` |
| `CostLog` | Budget tracking | `modelId`, `tokens`, `totalCostUsd` |
| `ForumTopic` | Telegram topics | `name`, `telegramTopicId` |
| `ChatMessage` | Conversation history | `userId`, `role`, `content` |

### 2.2 ChromaDB (Vector Store)

**URL:** `CHROMA_URL=http://localhost:8000`  
**Collections:**
- `article_summaries` → Summary embeddings for semantic search
- `predictions` → Prediction embeddings

**Usage:**
- Deduplication (semantic similarity)
- Related article discovery
- Topic clustering

### 2.3 Telegram Integration

**Supergroup Structure (Forum Topics):**

| Topic | Thread ID | Purpose | Content |
|-------|-----------|---------|---------|
| Main-News | Auto-created | Article summaries | Summary + metadata + buttons |
| Predictions | Auto-created | Forecasts | Predictions with confidence |
| Feedback | Auto-created | User chat | Q&A with feedback agent |
| System-Log | Auto-created | System events | Health reports, alerts |

**Bot Commands:**
```
/status     → System health report
/budget     → Monthly spending breakdown
/pause <agent>   → Pause an agent
/resume <agent>  → Resume an agent
/agents     → List agent configurations
```

### 2.4 OpenRouter (LLM API)

**Endpoint:** `https://openrouter.ai/api/v1`  
**Models:**

| Agent | Model | Cost/1M | Purpose |
|-------|-------|---------|---------|
| Analyst | `deepseek/deepseek-r1` | $0.55/$2.19 | Article analysis |
| Prediction | `deepseek/deepseek-r1` | $0.55/$2.19 | Forecast generation |
| Manager | `google/gemini-2.0-flash-001` | $0.10/$0.40 | Admin chat |
| Feedback | `openai/gpt-4o-mini` | $0.15/$0.60 | User interaction |

**Budget:** $7.30 USD/month hard limit ($14.50 USD = ~$20 CAD)

---

## 3. Database Schema

### Entity Relationships

```
User
├── Interest (1:many)
│   └── InterestSource (junction)
│       └── Source (many:1)
│           └── Article (1:many)
│               ├── Summary (1:1)
│               ├── Prediction (1:many)
│               └── MediaContent (1:many)
└── ChatMessage (1:many)
```

### Article Status Lifecycle

```
SCRAPED ──► ANALYZING ──► SUMMARIZED ──► POSTED
    │            │             │
    └────────► FAILED ◄────────┘
```

### Enums

```typescript
enum ArticleStatus {
  SCRAPED       // Just downloaded
  ANALYZING     // LLM processing
  SUMMARIZED    // Analysis complete
  POSTED        // Sent to Telegram
  FAILED        // Error occurred
}

enum CrawlMethod {
  CHEERIO       // Static HTML parsing
  PLAYWRIGHT    // JS-rendered pages
}

enum MediaType {
  VIDEO
  AUDIO
  PODCAST
}

enum SourceType {
  WEB
  RSS
  API
}
```

---

## 4. Agent System

### 4.1 Agent Definitions

All defined in `openclaw.json`:

```json
{
  "agents": [
    { "name": "manager",    "type": "conversational", "binding": "dm",      "model": "gemini" },
    { "name": "feedback",   "type": "conversational", "binding": "channel", "model": "gemini" },
    { "name": "scout",      "type": "cron",           "binding": null,      "model": null },
    { "name": "analyst",    "type": "cron",           "binding": null,      "model": null },
    { "name": "prediction", "type": "cron",           "binding": null,      "model": null }
  ]
}
```

### 4.2 Agent Personalities

**Manager Agent (`agents/manager/SOUL.md`):**
- Runs via cron trigger
- Executes: `npx tsx scripts/scout-run.ts`
- No decision-making, just script execution

**Feedback Agent (`agents/feedback/SOUL.md`):**
- Bound to Telegram supergroup
- Handles user replies and callback queries
- Manages interests and feedback

**Scout Agent (`agents/scout/SOUL.md`):**
- Cron-triggered scraping
- Executes: `npx tsx scripts/scout-run.ts`
- Loads interests → sources → scrapes → saves as SCRAPED

**Analyst Agent (`agents/analyst/SOUL.md`):**
- Single-article analysis
- Executes: `npx tsx scripts/analyst-process.ts --articleId=<id>`
- Calls DeepSeek, saves summary, updates to SUMMARIZED

**Prediction Agent (`agents/prediction/SOUL.md`):**
- Single-summary forecasting
- Executes: `npx tsx scripts/prediction-process.ts --summaryId=<id>`
- Calls DeepSeek, saves predictions, marks POSTED

---

## 5. Pipeline Flow

### 5.1 Cron Schedule

| Job | Schedule | Script | Purpose |
|-----|----------|--------|---------|
| scout-scrape | `0 */2 * * *` | scout-run.ts | Scrape all sources every 2h |
| pipeline-process | `15 */2 * * *` | pipeline-run.ts | Analyze, predict, post (15 min after scrape) |
| health-check | `*/15 * * * *` | health-check.ts | System health every 15 min |
| budget-check | `0 */6 * * *` | budget-check.ts | Budget status every 6h |

### 5.2 Scout Pipeline

```typescript
// 1. Load active interests
const interests = await db.interest.findMany({ where: { isActive: true } });

// 2. For each interest → get sources
for (const interest of interests) {
  const sources = await db.interestSource.findMany({ 
    where: { interestId: interest.id },
    include: { source: true }
  });

  // 3. Scrape each source
  for (const { source } of sources) {
    const crawler = source.crawlMethod === 'PLAYWRIGHT' 
      ? new PlaywrightCrawler()
      : new CheerioCrawler();
    
    const articles = await crawler.run([source.url]);
    
    // 4. Save articles
    for (const article of articles) {
      await db.article.create({
        data: {
          sourceId: source.id,
          url: article.url,
          title: article.title,
          rawFilePath: saveToDisk(article.content),
          status: 'SCRAPED'
        }
      });
    }
  }
}
```

### 5.3 Analysis Pipeline

```typescript
// 1. Query SCRAPED articles
const articles = await db.article.findMany({
  where: { status: 'SCRAPED' },
  take: 10  // Batch size
});

// 2. For each article
for (const article of articles) {
  // Update status
  await db.article.update({ where: { id: article.id }, data: { status: 'ANALYZING' } });
  
  // Read content
  const content = await readFile(article.rawFilePath, 'utf-8');
  
  // Call LLM
  const response = await chatCompletion(MODELS.ANALYST.id, [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: content.slice(0, 12000) }
  ]);
  
  const analysis = JSON.parse(response.content);
  
  // Save summary
  const summary = await db.summary.create({
    data: {
      articleId: article.id,
      content: analysis.summary,
      keyTopics: analysis.keyTopics,
      sentimentScore: analysis.sentimentScore,
      relevanceScore: analysis.relevanceScore
    }
  });
  
  // Update article
  await db.article.update({ where: { id: article.id }, data: { status: 'SUMMARIZED' } });
  
  // Upsert to ChromaDB
  await chroma.collection('article_summaries').upsert({
    ids: [`summary_${article.id}`],
    documents: [analysis.summary],
    metadata: { articleId, ... }
  });
  
  // Post to Telegram
  await sendTelegramMessage({
    topic: 'Main-News',
    text: formatSummary(analysis),
    buttons: [LIKE, DISLIKE, MORE, MUTE]
  });
}
```

### 5.4 Prediction Pipeline

```typescript
// 1. Query SUMMARIZED without predictions
const summaries = await db.summary.findMany({
  where: { Prediction: { none: {} } },
  include: { Article: true }
});

// 2. Generate predictions
for (const summary of summaries) {
  const response = await chatCompletion(MODELS.PREDICTION.id, [
    { role: 'system', content: PREDICTION_PROMPT },
    { role: 'user', content: summary.content }
  ]);
  
  const predictions = JSON.parse(response.content).predictions;
  
  // Save predictions
  for (const pred of predictions) {
    await db.prediction.create({
      data: {
        articleId: summary.articleId,
        content: pred.content,
        confidence: pred.confidence,
        timeHorizon: pred.timeHorizon
      }
    });
  }
  
  // Post to Telegram
  await sendTelegramMessage({
    topic: 'Predictions',
    text: formatPredictions(predictions)
  });
}
```

---

## 6. Scripts Reference

### 6.1 Core Pipeline

| Script | Args | Purpose | Output |
|--------|------|---------|--------|
| `scout-run.ts` | None | Scrape all sources | Count of saved articles |
| `pipeline-run.ts` | None | Run full pipeline | Processing stats |
| `analyst-process.ts` | `--articleId=<id>` | Analyze single article | `{ summaryId, chromaId, ... }` |
| `prediction-process.ts` | `--summaryId=<id>` | Generate predictions | Prediction IDs |
| `health-check.ts` | None | System health | JSON health report |
| `budget-check.ts` | None | Budget status | JSON budget report |
| `telegram-send.ts` | `--topic=<name> --text=<msg>` | Send to topic | Message ID |
| `telegram-callback.ts` | `--callbackId=<id>` | Answer callback | Confirmation |

### 6.2 Enhanced Scrapers

| Script | Args | Purpose | Output |
|--------|------|---------|--------|
| `scout-rss.ts` | `--source=<id>` `[--feed=<url>]` | Parse RSS/Atom feed | Count of saved articles |
| `scout-sitemap.ts` | `--source=<id> --url=<url> \| --discover=<url>` | Sitemap discovery | URL list |
| `scout-pdf.ts` | `--url=<url> \| --file=<path>` | Extract PDF text | Article ID |

### 6.3 Database CLI (`db-query.ts`)

| Resource | Action | Args |
|----------|--------|------|
| `user` | `ensure` | `--telegramId`, `--username` |
| `user` | `interests` | `--userId` |
| `interest` | `add` | `--userId`, `--topic`, `--description` |
| `interest` | `adjust` | `--interestId`, `--delta` |
| `interest` | `deactivate` | `--interestId` |
| `article` | `list-scraped` | `--limit` |
| `article` | `get-content` | `--articleId` |
| `summary` | `feedback` | `--summaryId`, `--action=like\|dislike` |
| `source` | `mute` | `--sourceId` |
| `agent-config` | `list` | None |
| `agent-config` | `update` | `--agentName`, `--isActive`, `--cronSchedule` |
| `agent-config` | `record-run` | `--agentName`, `--error` |
| `forum-topic` | `get` | `--name` |
| `forum-topic` | `ensure-all` | None |

---

## 7. Configuration

### 7.1 Environment Variables (`.env`)

**Required:**
```bash
DATABASE_URL=postgresql://openclaw_role:password@localhost:5432/infosentry
SCOUT_DATABASE_URL=postgresql://scout_role:password@localhost:5432/infosentry
OPENROUTER_API_KEY=sk-or-v1-...
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
TELEGRAM_ADMIN_ID=123456789
TELEGRAM_SUPERGROUP_ID=-1001234567890
CHROMA_URL=http://localhost:8000
```

**Optional:**
```bash
MONTHLY_BUDGET_USD=7.30          # Hard budget limit
DAILY_BUDGET_USD=0.24            # Daily allocation
ARTICLES_DIR=./data/articles     # Article storage
MEDIA_DIR=./data/media           # Media storage
NODE_ENV=production              # Environment

# Enhanced scrapper settings
SCOUT_ENABLE_AI_EXTRACTION=false
SCOUT_SEMANTIC_DEDUP=true
SCOUT_PAYWALL_SKIP=true
SCOUT_PDF_ENABLED=true
```

### 7.2 OpenClaw Config (`openclaw.json`)

```json
{
  "agentsDir": "./agents",
  "cronDir": "./cron",
  "scriptsDir": "./scripts",
  "bindings": {
    "manager": { "type": "dm", "userId": "${TELEGRAM_ADMIN_ID}" },
    "feedback": { "type": "channel", "channelId": "${TELEGRAM_SUPERGROUP_ID}" }
  }
}
```

### 7.3 Cron Jobs (`cron/jobs.json`)

```json
{
  "jobs": [
    {
      "name": "scout-scrape",
      "schedule": "0 */2 * * *",
      "script": "scripts/scout-run.ts"
    },
    {
      "name": "pipeline-process",
      "schedule": "15 */2 * * *",
      "script": "scripts/pipeline-run.ts"
    },
    {
      "name": "health-check",
      "schedule": "*/15 * * * *",
      "script": "scripts/health-check.ts"
    },
    {
      "name": "budget-check",
      "schedule": "0 */6 * * *",
      "script": "scripts/budget-check.ts"
    }
  ]
}
```

---

## 8. Skills & Extensions

### 8.1 Built-in Skills (in `skills/`)

| Skill | Purpose | Key Features |
|-------|---------|--------------|
| `scrapper-enhanced` | Modern scraping | RSS, sitemap, PDF, AI extraction, dedup |
| `scrapper-vantage` | Competitive intel | Diff tracking, trends, sentiment, pricing |
| `scrapper-ops` | Operations | Health checks, diagnostics, optimization |

### 8.2 Library Functions (`scripts/lib/`)

| File | Exports | Purpose |
|------|---------|---------|
| `prisma.ts` | `getOpenClawDb()`, `getScoutDb()`, `disconnectAll()` | Database clients |
| `chromadb.ts` | `getChromaClient()`, `COLLECTIONS` | Vector store client |
| `models.ts` | `MODELS`, `getBudgetTier()`, `estimateCost()` | LLM config & pricing |
| `openrouter.ts` | `chatCompletion()` | OpenRouter API wrapper |
| `budget.ts` | `canSpend()`, `logCost()` | Budget enforcement |

---

## 9. Development Workflow

### 9.1 Adding a New Source

```bash
# 1. Add source to database
psql $DATABASE_URL -c "
  INSERT INTO \"Source\" (id, name, url, type, crawlMethod, rssUrl)
  VALUES (gen_random_uuid()::text, 'Example Blog', 'https://example.com', 'WEB', 'CHEERIO', 'https://example.com/feed.xml');
"

# 2. Link to interest
psql $DATABASE_URL -c "
  INSERT INTO \"InterestSource\" (id, \"interestId\", \"sourceId\")
  SELECT gen_random_uuid()::text, i.id, s.id
  FROM \"Interest\" i, \"Source\" s
  WHERE i.topic = 'AI Safety' AND s.name = 'Example Blog';
"

# 3. Test RSS scraping (if available)
npm run scout:rss -- --source=<source-id> --dry-run

# 4. Test full scrape
npm run scout -- --source=<source-id>
```

### 9.2 Adding a New Interest

```bash
# Via CLI
npx tsx scripts/db-query.ts interest add \
  --userId=<admin-id> \
  --topic="Climate Tech" \
  --description="Clean energy, carbon capture, climate solutions"
```

### 9.3 Testing Pipeline

```bash
# 1. Run scout
npm run scout

# 2. Check scraped articles
npx tsx scripts/db-query.ts article list-scraped --limit=5

# 3. Analyze specific article
npx tsx scripts/analyst-process.ts --articleId=<id>

# 4. Generate predictions
npx tsx scripts/prediction-process.ts --summaryId=<id>

# 5. Full pipeline
npm run pipeline
```

### 9.4 Database Migrations

```bash
# Generate Prisma clients (both schemas)
npm run db:generate

# Run migrations
npm run db:migrate

# Seed initial data
npm run db:seed

# Setup PostgreSQL roles
npm run db:roles
```

---

## 10. Commands Quick Reference

### 10.1 Development

```bash
# Run scout manually
npm run scout

# Run full pipeline
npm run pipeline

# Check system health
npm run health

# Check budget status
npm run budget

# DB CLI
npm run db -- <resource> <action> [args]
```

### 10.2 Testing

```bash
# Test RSS feed
npx tsx scripts/scout-rss.ts --source=<id> --feed=<url> --dry-run

# Test sitemap discovery
npx tsx scripts/scout-sitemap.ts --discover=<url> --source=<id> --dry-run

# Test PDF extraction
npx tsx scripts/scout-pdf.ts --url=<pdf-url> --dry-run

# Analyze single article
npx tsx scripts/analyst-process.ts --articleId=<id>

# Send test Telegram message
npx tsx scripts/telegram-send.ts --topic=Main-News --text="Test message"
```

### 10.3 Operations

```bash
# Full health report
npx tsx scripts/ops-health.ts

# Diagnose specific source
npx tsx scripts/ops-diagnose.ts --source=<id>

# Data quality audit
npx tsx scripts/ops-audit.ts

# Clean up old data
npx tsx scripts/ops-cleanup.ts --older-than-days=30

# Performance analysis
npx tsx scripts/ops-optimize.ts
```

### 10.4 Infrastructure

```bash
# Start Docker services
docker compose up -d

# View logs
docker compose logs -f

# Restart services
docker compose restart

# Check OpenClaw status
openclaw doctor
openclaw agents list --bindings

# Start OpenClaw
openclaw start
```

---

## 11. File Organization

```
info-sentry/
├── REPO_INDEX.md              ← This file
├── SKILL_UPGRADE_SUMMARY.md   ← Enhancement documentation
├── README.md                  ← User-facing docs
├── openclaw.json              ← Agent config
├── package.json               ← Dependencies
├── docker-compose.yml         ← PostgreSQL + ChromaDB
├── .env                       ← Environment (gitignored)
├── .env.example               ← Environment template
│
├── agents/                    ← Agent personalities
│   ├── manager/SOUL.md
│   ├── feedback/SOUL.md
│   ├── scout/SOUL.md
│   ├── analyst/SOUL.md
│   └── prediction/SOUL.md
│
├── cron/                      ← Cron job definitions
│   └── jobs.json
│
├── scripts/                   ← Executable scripts
│   ├── scout-run.ts           ← Main scraper
│   ├── scout-rss.ts           ← ★ RSS parser
│   ├── scout-sitemap.ts       ← ★ Sitemap discovery
│   ├── scout-pdf.ts           ← ★ PDF extraction
│   ├── pipeline-run.ts        ← Pipeline orchestrator
│   ├── analyst-process.ts     ← LLM analysis
│   ├── prediction-process.ts  ← LLM predictions
│   ├── health-check.ts        ← System health
│   ├── budget-check.ts        ← Budget status
│   ├── telegram-send.ts       ← Telegram sender
│   ├── telegram-callback.ts   ← Callback handler
│   ├── db-query.ts            ← DB CLI
│   └── lib/                   ← Shared libraries
│       ├── prisma.ts
│       ├── chromadb.ts
│       ├── models.ts
│       ├── openrouter.ts
│       └── budget.ts
│
├── prisma/                    ← Database schema
│   ├── schema.prisma          ← Main schema
│   ├── scout-schema.prisma    ← Restricted schema
│   ├── roles.sql              ← PostgreSQL roles
│   └── seed.ts                ← Initial data
│
├── skills/                    ← ★ New skills modules
│   ├── scrapper-enhanced/     ← Modern scraping
│   │   └── SKILL.md
│   ├── scrapper-vantage/      ← Competitive intel
│   │   └── SKILL.md
│   └── scrapper-ops/          ← Operations
│       └── SKILL.md
│
└── data/                      ← Runtime data
    └── articles/              ← Scraped article .md files
```

---

## 12. Troubleshooting

### 12.1 Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| `Rate limit on Gemini` | OpenRouter free tier | Switch to DeepSeek in models.ts |
| `ChromaDB connection refused` | Service not running | `docker compose up chromadb -d` |
| `Database connection error` | Wrong URL or service down | Check DATABASE_URL, start docker |
| `Telegram "chat not found"` | Wrong SUPERGROUP_ID | Check ID starts with -100 |
| `Empty articles` | Paywall or JS-required | Try PLAYWRIGHT crawl method |
| `High costs` | Too many/bad sources | Audit sources, mute low-quality |
| `Duplicate articles` | URL normalization issue | Enable SCOUT_SEMANTIC_DEDUP |

### 12.2 Debug Commands

```bash
# Check services
psql $DATABASE_URL -c "SELECT version();"
curl http://localhost:8000/api/v1/heartbeat  # ChromaDB

# View recent logs
docker compose logs --tail=100

# Check agent status
openclaw agents list

# Test telegram
npx tsx scripts/telegram-send.ts --chat=ADMIN --text="Test"

# Check budget
npx tsx scripts/db-query.ts agent-config list
```

---

## 13. Enhancement Ideas

### 13.1 Implemented (in skills/)

- ✅ RSS/Atom feed parsing
- ✅ Sitemap discovery
- ✅ PDF text extraction
- ✅ Semantic deduplication
- ✅ Paywall detection
- ✅ Competitive monitoring
- ✅ Trend detection
- ✅ Health diagnostics

### 13.2 Planned

- [ ] Multi-language support
- [ ] Audio transcription (Whisper)
- [ ] Image analysis (GPT-4 Vision)
- [ ] Real-time alerts (webhooks)
- [ ] Custom analysis prompts per interest
- [ ] Source quality scoring
- [ ] Prediction accuracy tracking
- [ ] Collaborative filtering

---

**Remember:** This is a living document. Update it as the system evolves.

**For quick lookup:**
- Scripts: See Section 6
- DB CLI: See Section 6.3
- Commands: See Section 10
- Troubleshooting: See Section 12
