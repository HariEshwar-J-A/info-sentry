# Architecture

## Overview

Info-Sentry is a personal intelligence system that continuously scouts the web, analyses content with AI, and surfaces the most relevant signals across news and GitHub. Everything runs locally on a single machine.

```
┌──────────────────────────────────────────────────────────┐
│                     OpenClaw Gateway                     │
│                    (port 18790)                          │
│   Manager · Scout · Analyst · Prediction · Feedback      │
└───────────────────┬──────────────────────────────────────┘
                    │ agent calls
        ┌───────────▼────────────────────┐
        │         Scripts layer          │
        │  scout-run · pipeline-run      │
        │  github-scout · github-analyst │
        └───────────┬────────────────────┘
                    │ read/write
        ┌───────────▼────────────────────┐
        │        PostgreSQL (Prisma)     │
        │   20 models · single DB        │
        └───────────┬────────────────────┘
                    │ embeddings
        ┌───────────▼────────────────────┐
        │           ChromaDB             │
        │   article embeddings (local)   │
        └────────────────────────────────┘

        ┌──────────────────┐   ┌───────────────────────────┐
        │   Next.js Web    │   │    Telegram Supergroup     │
        │   (port 3001)    │   │  Main-News · Predictions  │
        │   GitHub Feed    │   │  GitHub-Feed · Feedback   │
        │   Sources · etc. │   │  System-Log               │
        └──────────────────┘   └───────────────────────────┘
```

## Data flow

```
Scout (RSS + web crawl + GitHub API)
    ↓ saves Article/GitHubRepo records (status=SCRAPED)
Analyst (LLM via OpenRouter)
    ↓ generates summaries, posts to Telegram Main-News (status=SUMMARIZED)
Predictor
    ↓ generates predictions, posts to Telegram Predictions (status=POSTED)
GitHub Analyst
    ↓ generates AI analysis from README, posts to Telegram GitHub-Feed
```

## Services

| Service | Command | Port | Role |
|---|---|---|---|
| OpenClaw gateway | `openclaw ... gateway --port 18790` | 18790 | Agent runtime |
| Next.js web | `npm --prefix web run dev` | 3001 | UI + API routes |
| Telegram bot | `tsx scripts/telegram-bot.ts` | — | User commands + callbacks |

## Model selection

LLM calls use a budget-aware tier system (see `scripts/lib/models.ts`):

| Tier | Monthly spend | Analyst | Predictor | Summarizer |
|---|---|---|---|---|
| 1 | < 40 % | DeepSeek R1 | Kimi K2.6 | Gemini 2.0 Flash |
| 2 | 40–70 % | Gemini Flash | DeepSeek V3.2 | Gemini 2.0 Flash |
| 3 | 70–90 % | GPT-4o Mini | GPT-4o Mini | GPT-4o Mini |
| 4 | > 90 % | Llama 3 8B | Llama 3 8B | Llama 3 8B |

Budget: **$7.30 USD / month** (configurable via `MONTHLY_BUDGET_USD`).
