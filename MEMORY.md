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