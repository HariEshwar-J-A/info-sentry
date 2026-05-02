# Info-Sentry

A personal news intelligence system powered by 6 AI agents running on [OpenClaw](https://openclaw.dev). Scrapes news sources based on your interests, analyses articles with LLMs, generates forward-looking predictions, and delivers everything to a Telegram supergroup with interactive feedback buttons.

## Architecture

```
Vision (master gateway  :18789)          Info-Sentry (slave gateway :18790)
~/.openclaw/                             /Documents/code/info-sentry/
     │                                           │
     └─ delegates project tasks ──────────────► ├── coder     (Kimi K2.6)       ← code changes
                                                 ├── manager   (DeepSeek V3.2)   ← health/budget → admin DM
                                                 ├── feedback  (DeepSeek V3.2)   ← supergroup Feedback topic
                                                 │
                                                 ├── Cron (hourly)
                                                 │   ├── scout      :00   → scrape sources
                                                 │   ├── pipeline   :15   → analyse → predict → post
                                                 │   └── system-log */30  → health snapshot to System-Log
                                                 │
                                                 └── Telegram (@vision_newsletter_bot)
                                                     ├── Main-News   (thread 5) ← summaries + buttons
                                                     ├── Predictions (thread 6) ← predictions + buttons
                                                     ├── Feedback    (thread 7) ← interest management
                                                     └── System-Log  (thread 8) ← health snapshots
```

### Agent Model Map

| Agent | Model | Purpose |
|-------|-------|---------|
| **coder** | Kimi K2.6 | Code changes, bug fixes, git operations |
| **manager** | DeepSeek V3.2 | Health monitoring, budget, agent control |
| **feedback** | DeepSeek V3.2 | Supergroup interaction, interest management |
| **scout** | Gemini Flash Lite | Crawlee scraping (no LLM needed) |
| **analyst** | DeepSeek V3.2 | Article summarisation, sentiment scoring |
| **prediction** | DeepSeek V3.2 | Forward predictions with ChromaDB context |

### Pipeline Flow

```
Scout (:00 every hour)               Pipeline (:15 every hour)
        │                                     │
        ├─ Load active interests              ├─ Query articles WHERE status = SCRAPED
        ├─ For each interest → sources        ├─ For each article:
        ├─ Scrape via Cheerio/Playwright      │   ├─ analyst-process.ts → summary
        ├─ Save to data/articles/             │   ├─ Post to Main-News (thread 5)
        └─ Mark status: SCRAPED              │   ├─ prediction-process.ts → predictions
                                              │   ├─ Post to Predictions (thread 6)
                                              │   └─ Mark status: POSTED
                                              └─ system-log-post.ts every 30min → System-Log
```

---

## Prerequisites

- **Node.js 22+**
- **PostgreSQL 17** (Homebrew: `brew install postgresql@17`)
- **ChromaDB** (Python: `pip install chromadb`)
- **OpenClaw** v2026.3.23-2+ (`npm install -g openclaw`)
- **OpenRouter** API key ([openrouter.ai](https://openrouter.ai))
- **Telegram Bot** via [@BotFather](https://t.me/BotFather)
- A **Telegram Supergroup** with Forum Topics enabled

---

## Setup

### 1. Clone to Documents/code

```bash
git clone https://github.com/HariEshwar-J-A/info-sentry.git ~/Documents/code/info-sentry
cd ~/Documents/code/info-sentry
npm install
```

### 2. Environment Variables

```bash
cp .env.example .env
```

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SCOUT_DATABASE_URL` | Restricted scout role connection |
| `OPENROUTER_API_KEY` | OpenRouter key (openrouter.ai) |
| `TELEGRAM_BOT_TOKEN` | Newsletter bot token from BotFather |
| `TELEGRAM_ADMIN_ID` | Your Telegram user ID |
| `TELEGRAM_SUPERGROUP_ID` | Supergroup chat ID (starts with `-100`) |
| `CHROMA_URL` | `http://localhost:8000` |
| `MONTHLY_BUDGET_USD` | Hard spending limit (e.g. `7.30`) |
| `ARTICLES_DIR` | `./data/articles` |

### 3. Start Infrastructure

```bash
# PostgreSQL (Homebrew)
brew services start postgresql@17

# ChromaDB
python3 -m chromadb run --path ./data/chromadb --host 127.0.0.1 --port 8000 &
```

### 4. Database Setup

```bash
npm run db:generate     # Generate Prisma clients
npm run db:migrate      # Create tables
npm run db:seed         # Seed admin user + agent configs
```

### 5. Create Telegram Forum Topics

```bash
npx tsx scripts/db-query.ts forum-topic ensure-all
```

Creates four topics in your supergroup: **Main-News**, **Predictions**, **Feedback**, **System-Log**.

---

## Running

### Start the Slave Gateway (Info-Sentry)

This project runs its own OpenClaw gateway on port **18790**, isolated from Vision (master at 18789).

```bash
cd ~/Documents/code/info-sentry
openclaw --profile info-sentry gateway --port 18790
```

Or via LaunchAgent (auto-starts at login):

```bash
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/ai.openclaw.info-sentry.plist
```

### Start the Telegram Bot

The newsletter bot polls `@vision_newsletter_bot` for DM commands and supergroup button callbacks:

```bash
npx tsx scripts/telegram-bot.ts
```

Or via LaunchAgent:
```bash
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.infosentry.bot.plist
```

### All Services via LaunchAgents

After first-time setup, all four services start automatically at login:

| LaunchAgent | Service | Port |
|-------------|---------|------|
| `ai.openclaw.info-sentry.plist` | OpenClaw slave gateway | 18790 |
| `com.infosentry.bot.plist` | Telegram polling bot | — |
| `com.infosentry.chromadb.plist` | ChromaDB vector store | 8000 |
| `homebrew.mxcl.postgresql@17.plist` | PostgreSQL | 5432 |

### Manual Script Execution

```bash
npm run scout       # Scrape all sources
npm run pipeline    # Full analyse + predict + post pipeline
npm run health      # System health check (JSON)
npm run budget      # Budget status (JSON)

# Individual scripts
npx tsx scripts/analyst-process.ts --articleId=<id>
npx tsx scripts/prediction-process.ts --summaryId=<id>
npx tsx scripts/system-log-post.ts
npx tsx scripts/telegram-bot.ts --send-test   # Send a test message
```

---

## Telegram Interaction

### Admin DM (`@vision_newsletter_bot`)

| Command | Action |
|---------|--------|
| `/status` | Live system stats (agents, articles, budget) |
| `/budget` | Monthly spend breakdown by agent |
| `/run` | Trigger scout + pipeline now |
| `/pending` | Show predictions awaiting validation |

### Supergroup: Main-News (thread 5)

Pipeline posts article summaries here with inline buttons:

| Button | Effect |
|--------|--------|
| 👍 Relevant | Boosts related interest scores |
| 👎 Not for me | Lowers related interest scores |
| 🔍 More on this | Shows article's key topic tags |
| 🔇 Mute source | Stops scraping that site permanently |

### Supergroup: Predictions (thread 6)

Predictions posted here with:

| Button | Effect |
|--------|--------|
| 📌 Track this | Acknowledges you're watching it |
| 🗑️ Not useful | Marks prediction EXPIRED |

### Supergroup: Feedback (thread 7)

Always listening. Type naturally to manage your interests:

```
add Canadian PR news
remove Bloomberg
list
boost Canadian PR Pathways
describe Canadian PR as focus on Ontario OINP tech draws only
```

### Supergroup: System-Log (thread 8)

Automatic health snapshot every 30 minutes. No interaction needed.

---

## Model Configuration

Configured in `openclaw.json`:

| Alias | Provider Model | Used By |
|-------|---------------|---------|
| `kimi-k2.6` | `moonshotai/kimi-k2.6` | coder agent |
| `deepseek-v3` | `deepseek/deepseek-v3.2` | manager, feedback, analyst, prediction |
| `gemini-flash` | `google/gemini-3.1-flash-lite` | scout (fallback) |

Pipeline scripts use tiered model fallback based on monthly budget spend (see `scripts/lib/models.ts`).

---

## Agent Souls

All agent personalities live in `agents/` — sourced from the [agency-agents](https://github.com/HariEshwar-J-A/agency-agents) repository:

```
agents/
├── coder.md       Kimi K2.6 — code changes, TypeScript, git
├── manager.md     DeepSeek V3.2 — health, budget, admin DM
├── feedback.md    DeepSeek V3.2 — supergroup interaction, interest management
├── scout.md       Gemini Flash Lite — web scraping pipeline worker
├── analyst.md     DeepSeek V3.2 — article analysis pipeline worker
└── prediction.md  DeepSeek V3.2 — forward prediction pipeline worker
```

---

## Budget

Hard limit: **$7.30 USD/month** (~$10 CAD). Configured in `.env` as `MONTHLY_BUDGET_USD`.

| Spend % | Model Tier | Models Used |
|---------|-----------|-------------|
| < 40% | Tier 1 | DeepSeek V3.2 |
| 40–70% | Tier 2 | Gemini Flash |
| 70–90% | Tier 3 | Gemini Flash Lite |
| > 90% | Tier 4 | Free Llama 3.1 8B |

---

## Database Schema

Key models in `prisma/schema.prisma`:

| Model | Description |
|-------|-------------|
| `User` | Telegram users |
| `Interest` | Tracked topics with scores |
| `Source` | News sources with trust scores |
| `Article` | Scraped articles (SCRAPED → SUMMARIZED → POSTED) |
| `Summary` | LLM-generated summaries |
| `Prediction` | Forward predictions |
| `ValidationQueue` | Human-in-the-loop approval queue |
| `ForumTopic` | Telegram topic thread IDs |
| `CostLog` | Per-call LLM cost tracking |

---

## OpenClaw Known Issues & CVEs

| Issue | Mitigation |
|-------|-----------|
| CVE-2026-25253: Gateway binds to all interfaces | Config locks to `127.0.0.1` only |
| v2026.3.22 packaging bugs | Use v2026.3.23-2+ |
| Session history loss on restart | Backed by PostgreSQL `ChatMessage` table |

---

## License

See [LICENSE](./LICENSE).
