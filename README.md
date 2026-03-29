# Info-Sentry

A personal news intelligence system powered by 5 AI agents running on [OpenClaw](https://openclaw.dev). It scrapes news sources based on your interests, analyzes articles with LLMs, generates forward-looking predictions, and delivers everything to a Telegram supergroup with interactive feedback buttons.

## Architecture

```
OpenClaw Runtime (Gateway on 127.0.0.1:18789)
│
├── manager       ← Private DM with admin (health, budget, agent control)
├── feedback      ← Supergroup responder (interests, feedback, callbacks)
│
├── Cron Jobs
│   ├── scout-scrape      every 2h at :00   → scrape sources
│   ├── pipeline-process  every 2h at :15   → analyze → predict → post
│   ├── health-check      every 15min       → system status
│   └── budget-check      every 6h          → spending report
│
└── scripts/              CLI tools called via exec
    ├── scout-run.ts           Crawlee scraping (Cheerio + Playwright)
    ├── pipeline-run.ts        Full pipeline orchestrator
    ├── analyst-process.ts     Single article LLM analysis
    ├── prediction-process.ts  Single summary LLM predictions
    ├── health-check.ts        System health report
    ├── budget-check.ts        Budget status report
    ├── db-query.ts            Generic DB CLI for agents
    ├── telegram-send.ts       Forum topics + inline keyboards
    ├── telegram-callback.ts   Answer callback queries
    └── lib/
        ├── prisma.ts          Dual Prisma client singletons
        ├── chromadb.ts        ChromaDB client + collections
        ├── models.ts          Model configs + pricing
        ├── openrouter.ts      OpenRouter API wrapper
        └── budget.ts          Cost tracking + budget checks
```

### Pipeline Flow

```
Scout (cron :00)                    Pipeline (cron :15)
    │                                   │
    ├─ Load active interests            ├─ Query articles WHERE status = SCRAPED
    ├─ For each interest → sources      ├─ For each article:
    ├─ Scrape via Cheerio/Playwright    │   ├─ analyst-process.ts (DeepSeek V3.2)
    ├─ Save to disk + DB               │   ├─ Save summary → Postgres + ChromaDB
    └─ Mark status: SCRAPED             │   ├─ Post summary → Telegram #Main-News
                                        │   ├─ prediction-process.ts (DeepSeek V3.2)
                                        │   ├─ Save predictions → Postgres + ChromaDB
                                        │   ├─ Post predictions → Telegram #Predictions
                                        │   └─ Mark status: POSTED
                                        └─ Record agent runs
```

### Agent Types

| Agent | Type | Model | Binding | Purpose |
|-------|------|-------|---------|---------|
| **Manager** | Conversational | Gemini 3.1 Flash Lite | Private DM | Health, budget, agent control |
| **Feedback** | Conversational | Gemini 3.1 Flash Lite | Supergroup | User interaction, feedback |
| **Scout** | Pipeline (cron) | — | None | Web scraping |
| **Analyst** | Pipeline (cron) | DeepSeek V3.2 | None | Article analysis |
| **Prediction** | Pipeline (cron) | DeepSeek V3.2 | None | Forward-looking predictions |

### LLM Cost Estimates

| Model | Cost (per 1M tokens) | Typical Monthly Usage |
|-------|---------------------|-----------------------|
| DeepSeek V3.2 | $0.25 in / $0.38 out | ~$3-8 (pipeline) |
| Gemini 3.1 Flash Lite | $0.25 in / $2.00 out | ~$0.50-1.00 (chat) |
| **Total** | | **~$4-9 USD/month** |

Budget hard limit: **$14.50 USD/month** (~$20 CAD). Pipeline scripts check budget before every LLM call.

---

## Prerequisites

- **Node.js** 22+
- **Docker** and **Docker Compose** (for PostgreSQL + ChromaDB)
- **OpenClaw** v2026.3.23-2+ installed on your server
- **OpenRouter** API key ([openrouter.ai](https://openrouter.ai))
- **Telegram Bot** created via [@BotFather](https://t.me/BotFather)
- A **Telegram Supergroup** with Forum Topics enabled

---

## Setup

### 1. Clone and Install

```bash
git clone https://github.com/your-username/info-sentry.git
cd info-sentry
npm install
```

### 2. Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your values:

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection (openclaw role) | `postgresql://openclaw_role:openclaw_password@localhost:5432/infosentry` |
| `SCOUT_DATABASE_URL` | PostgreSQL connection (scout role, restricted) | `postgresql://scout_role:scout_password@localhost:5432/infosentry` |
| `OPENROUTER_API_KEY` | OpenRouter API key | `sk-or-v1-...` |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token from BotFather | `123456:ABC-DEF...` |
| `TELEGRAM_ADMIN_ID` | Your Telegram user ID (for manager DM) | `123456789` |
| `TELEGRAM_SUPERGROUP_ID` | Supergroup chat ID (starts with -100) | `-1001234567890` |
| `CHROMA_URL` | ChromaDB endpoint | `http://localhost:8000` |
| `MONTHLY_BUDGET_USD` | Monthly LLM spending limit in USD | `14.50` |
| `ARTICLES_DIR` | Directory for raw article files | `./data/articles` |
| `NODE_ENV` | Environment | `production` |

### 3. Start Infrastructure

```bash
docker compose up -d
```

This starts:
- **PostgreSQL 17** on port 5432 (with roles auto-created via `prisma/roles.sql`)
- **ChromaDB** on port 8000

Verify they're running:

```bash
docker compose ps
```

### 4. Database Setup

```bash
# Generate Prisma clients (both openclaw + scout)
npm run db:generate

# Run migrations to create tables
npm run db:migrate

# Seed admin user + agent configs
npm run db:seed
```

### 5. Create Telegram Forum Topics

```bash
npx tsx scripts/db-query.ts forum-topic ensure-all
```

This auto-creates four forum topics in your supergroup:
- **Main-News** — article summaries
- **Predictions** — forward-looking predictions
- **Feedback** — user interaction
- **System-Log** — system notifications

### 6. Validate OpenClaw Config

```bash
openclaw doctor
openclaw agents list --bindings
```

Expected output: 5 agents (manager, feedback, scout, analyst, prediction), all with correct bindings and tools.

---

## Running

### With OpenClaw (Production)

```bash
openclaw start
```

OpenClaw handles everything:
- Starts the gateway on `127.0.0.1:18789`
- Loads all 5 agents with their SOUL.md files
- Binds manager to your private DM, feedback to the supergroup
- Schedules cron jobs (scout at :00, pipeline at :15, health every 15min, budget every 6h)

### Manual Script Execution (Development / Debugging)

Every script can be run independently for testing:

```bash
# Scrape all sources
npx tsx scripts/scout-run.ts

# Run full pipeline (analyze + predict + post)
npx tsx scripts/pipeline-run.ts

# Analyze a single article
npx tsx scripts/analyst-process.ts --articleId=<id>

# Generate predictions for a summary
npx tsx scripts/prediction-process.ts --summaryId=<id>

# System health check
npx tsx scripts/health-check.ts

# Budget status
npx tsx scripts/budget-check.ts

# Send a Telegram message
npx tsx scripts/telegram-send.ts --topic=Main-News --text="Hello world"
npx tsx scripts/telegram-send.ts --chat=ADMIN --text="Test DM"

# Answer a callback query
npx tsx scripts/telegram-callback.ts --callbackId=<id> --text="Done!"
```

### npm Script Shortcuts

```bash
npm run scout       # Run scout scraper
npm run pipeline    # Run full pipeline
npm run health      # Health check
npm run budget      # Budget check
npm run db          # DB query CLI (add args after --)
```

---

## Database CLI Reference

The `db-query.ts` script is the universal DB interface for all agents.

```bash
npx tsx scripts/db-query.ts <resource> <action> [--key=value ...]
```

### Resources and Actions

#### `user`
```bash
# Ensure a user exists (create or update)
npx tsx scripts/db-query.ts user ensure --telegramId=123456789 --username=john

# Get a user's interests
npx tsx scripts/db-query.ts user interests --userId=<id>
```

#### `chat`
```bash
# Get chat history
npx tsx scripts/db-query.ts chat history --userId=<id> --limit=20

# Save a chat message
npx tsx scripts/db-query.ts chat save --userId=<id> --role=USER --content="hello" --agentName=feedback
```

#### `interest`
```bash
# Add or reactivate an interest
npx tsx scripts/db-query.ts interest add --userId=<id> --topic="AI Safety" --description="AI alignment research"

# Adjust interest score (delta: -2.0 to +2.0)
npx tsx scripts/db-query.ts interest adjust --interestId=<id> --delta=0.2

# Deactivate an interest
npx tsx scripts/db-query.ts interest deactivate --interestId=<id>
```

#### `summary`
```bash
# Submit feedback on a summary
npx tsx scripts/db-query.ts summary feedback --summaryId=<id> --action=like
npx tsx scripts/db-query.ts summary feedback --summaryId=<id> --action=dislike

# Get full summary details
npx tsx scripts/db-query.ts summary get --summaryId=<id>
```

#### `source`
```bash
# Mute a source (stop scraping it)
npx tsx scripts/db-query.ts source mute --sourceId=<id>
```

#### `agent-config`
```bash
# List all agent configurations
npx tsx scripts/db-query.ts agent-config list

# Pause or resume an agent
npx tsx scripts/db-query.ts agent-config update --agentName=scout --isActive=false
npx tsx scripts/db-query.ts agent-config update --agentName=scout --isActive=true

# Change an agent's cron schedule
npx tsx scripts/db-query.ts agent-config update --agentName=scout --cronSchedule="0 */4 * * *"

# Record a completed run
npx tsx scripts/db-query.ts agent-config record-run --agentName=scout
npx tsx scripts/db-query.ts agent-config record-run --agentName=scout --error="Timeout"
```

#### `article`
```bash
# List articles pending processing
npx tsx scripts/db-query.ts article list-scraped --limit=10

# Read raw article content from disk
npx tsx scripts/db-query.ts article get-content --articleId=<id>
```

#### `forum-topic`
```bash
# Get a specific topic's Telegram thread ID
npx tsx scripts/db-query.ts forum-topic get --name=Main-News

# Create all required forum topics
npx tsx scripts/db-query.ts forum-topic ensure-all
```

---

## Database Schema

11 models across two Prisma schemas:

| Model | Schema | Description |
|-------|--------|-------------|
| `User` | openclaw | Telegram users with admin flag |
| `Interest` | both | Topics to track, with scores |
| `Source` | both | News sources with trust scores |
| `InterestSource` | both | Many-to-many junction |
| `Article` | both | Scraped articles with status lifecycle |
| `Summary` | openclaw | LLM-generated article summaries |
| `Prediction` | openclaw | Forward-looking predictions |
| `ChatMessage` | openclaw | Conversation history |
| `AgentConfig` | openclaw | Per-agent settings and status |
| `CostLog` | openclaw | LLM cost tracking per call |
| `ForumTopic` | openclaw | Telegram forum topic mappings |

### Article Status Lifecycle

```
SCRAPED → ANALYZING → SUMMARIZED → POSTED
                 ↘ FAILED
```

### Security Model

Two PostgreSQL roles enforce least-privilege access:

| Role | Permissions |
|------|------------|
| `openclaw_role` | Full CRUD on all tables |
| `scout_role` | SELECT on Interest, Source, InterestSource; SELECT + INSERT on Article |

---

## Telegram Integration

### Supergroup Forum Topics

| Topic | Content | Buttons |
|-------|---------|---------|
| **Main-News** | Article summaries with sentiment, topics, relevance | Like, Dislike, More on this, Mute source |
| **Predictions** | Forward-looking predictions with confidence levels | Track, Dismiss |
| **Feedback** | User conversations with the feedback agent | — |
| **System-Log** | Health reports, errors, budget warnings | — |

### Admin DM Commands

Send these to the bot in your private DM:

| Command | Action |
|---------|--------|
| `/status` | System health report |
| `/budget` | Monthly spending breakdown |
| `/pause scout` | Pause the scout agent |
| `/resume scout` | Resume the scout agent |
| `/agents` | List all agent configurations |

---

## Adding Interests and Sources

After initial setup, add your interests and sources via the DB CLI or directly via SQL:

```bash
# 1. Add an interest
npx tsx scripts/db-query.ts interest add \
  --userId=<your-user-id> \
  --topic="AI Safety" \
  --description="AI alignment, interpretability, and governance"

# 2. Add a source (via psql or a custom script)
psql $DATABASE_URL -c "
  INSERT INTO \"Source\" (id, name, url, type, \"crawlMethod\", \"rssUrl\")
  VALUES (
    gen_random_uuid()::text,
    'MIT Tech Review',
    'https://www.technologyreview.com/topic/artificial-intelligence/',
    'WEB',
    'CHEERIO',
    'https://www.technologyreview.com/feed/'
  );
"

# 3. Link interest to source
psql $DATABASE_URL -c "
  INSERT INTO \"InterestSource\" (id, \"interestId\", \"sourceId\")
  SELECT gen_random_uuid()::text, i.id, s.id
  FROM \"Interest\" i, \"Source\" s
  WHERE i.topic = 'AI Safety' AND s.name = 'MIT Tech Review';
"
```

---

## OpenClaw Known Issues

| Issue | Mitigation |
|-------|-----------|
| CVE-2026-25253: Gateway binds to all interfaces | Config locks to `127.0.0.1` only |
| v2026.3.22 packaging bugs | Use v2026.3.23-2 or later |
| Provider-level cooldown bug | Pipeline runs sequentially, no concurrent LLM calls |
| Session history loss on restart | Chat history backed by PostgreSQL `ChatMessage` table |

---

## Project Structure

```
info-sentry/
├── openclaw.json              OpenClaw multi-agent config
├── package.json               Node.js dependencies
├── tsconfig.json              TypeScript config
├── docker-compose.yml         PostgreSQL + ChromaDB
├── Dockerfile.scout           Docker image for Scout sandbox
├── .env.example               Environment template
│
├── agents/
│   ├── manager/SOUL.md        Manager personality + instructions
│   ├── feedback/SOUL.md       Feedback personality + instructions
│   ├── scout/SOUL.md          Scout cron instructions
│   ├── analyst/SOUL.md        Analyst cron instructions
│   └── prediction/SOUL.md     Prediction instructions
│
├── cron/
│   └── jobs.json              OpenClaw cron job definitions
│
├── scripts/
│   ├── scout-run.ts           Crawlee web scraper
│   ├── pipeline-run.ts        Pipeline orchestrator
│   ├── analyst-process.ts     Single article LLM analysis
│   ├── prediction-process.ts  Single summary LLM predictions
│   ├── health-check.ts        System health JSON report
│   ├── budget-check.ts        Budget status JSON report
│   ├── db-query.ts            Universal DB CLI
│   ├── telegram-send.ts       Send Telegram messages
│   ├── telegram-callback.ts   Answer callback queries
│   └── lib/
│       ├── prisma.ts          Dual Prisma client singletons
│       ├── chromadb.ts        ChromaDB client
│       ├── models.ts          Model configs + pricing
│       ├── openrouter.ts      OpenRouter API wrapper
│       └── budget.ts          Cost tracking + budget checks
│
├── prisma/
│   ├── schema.prisma          Main schema (11 models)
│   ├── scout-schema.prisma    Restricted schema for Scout
│   ├── roles.sql              PostgreSQL role definitions
│   └── seed.ts                Admin user + agent config seeder
│
└── data/
    └── articles/              Raw scraped article .md files
```

---

## License

See [LICENSE](./LICENSE).
