# ─────────────────────────────────────────────────────────────────────────────
#  Info-Sentry — convenience aliases
#  All commands delegate to scripts/manage.sh or npm scripts.
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: dev start stop restart status setup \
        db-generate db-migrate db-seed \
        pipeline scout health budget bot logs

# ── Service lifecycle ─────────────────────────────────────────────────────────
dev:      ## Start all services in foreground (Ctrl+C kills everything)
	@./scripts/manage.sh dev

start:    ## Start all services in the background
	@./scripts/manage.sh start

stop:     ## Stop all background services
	@./scripts/manage.sh stop

restart:  ## Restart all services
	@./scripts/manage.sh restart

status:   ## Show service status and port availability
	@./scripts/manage.sh status

# ── First-time setup ──────────────────────────────────────────────────────────
setup:    ## Install dependencies and generate Prisma client
	npm install
	npm run db:generate
	@echo "✓ Setup complete. Copy .env.example → .env and fill in credentials."
	@echo "  Then run: make db-migrate   (first-time DB setup)"
	@echo "       or: make dev           (start all services)"

# ── Database ──────────────────────────────────────────────────────────────────
db-generate: ## Regenerate Prisma client after schema changes
	npm run db:generate

db-migrate: ## Apply schema migrations to the database
	npm run db:migrate

db-seed: ## Seed the database with initial data
	npm run db:seed

db-topics: ## Ensure all Telegram forum topics exist in the supergroup
	npx tsx scripts/db-query.ts forum-topic ensure-all

# ── Pipeline & agents ─────────────────────────────────────────────────────────
pipeline: ## Run the full news pipeline (scout → analyst → predictor)
	npm run pipeline

scout:    ## Run the news scout (scrape sources)
	npm run scout

github:   ## Run the GitHub scout + analyst for all interests
	npx tsx scripts/github-scout.ts && npx tsx scripts/github-analyst.ts

health:   ## Run the health check
	npm run health

budget:   ## Show current LLM budget usage
	npm run budget

bot:      ## Start the Telegram bot (foreground)
	npm run bot

# ── Logs ──────────────────────────────────────────────────────────────────────
logs:     ## Tail logs for all background services
	@tail -f logs/gateway.log logs/web.log logs/bot.log 2>/dev/null || \
	  echo "No log files found. Start services first: make start"

logs-%:   ## Tail a specific service log (e.g. make logs-web)
	@tail -f logs/$*.log

# ── Help ──────────────────────────────────────────────────────────────────────
help:     ## Show this help
	@grep -E '^[a-zA-Z_%-]+:.*##' $(MAKEFILE_LIST) | \
	  awk 'BEGIN {FS = ":.*##"}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
