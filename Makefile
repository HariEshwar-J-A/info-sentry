# ─────────────────────────────────────────────────────────────────────────────
#  Info-Sentry — convenience aliases
#  All commands delegate to scripts/manage.sh or npm scripts.
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: dev start stop restart status setup \
        db-up db-down db-reset db-generate db-migrate db-seed db-topics \
        db-shell db-logs docker-install \
        pipeline scout github health budget bot logs help \
        brief weekly decay youtube

# ── Service lifecycle ─────────────────────────────────────────────────────────
dev:      ## Start DB + all app services in foreground (Ctrl+C kills everything)
	@./scripts/manage.sh dev

start:    ## Start DB + all app services in the background
	@./scripts/manage.sh start

stop:     ## Stop all app services and DB containers
	@./scripts/manage.sh stop

restart:  ## Restart everything
	@./scripts/manage.sh restart

status:   ## Show status for all services, containers, and ports
	@./scripts/manage.sh status

# ── First-time setup ──────────────────────────────────────────────────────────
setup:    ## Install dependencies and generate Prisma client
	npm install
	npm run db:generate
	@echo ""
	@echo "Next steps:"
	@echo "  1. cp .env.example .env  (and fill in POSTGRES_PASSWORD etc.)"
	@echo "  2. make start            (starts DB + runs migrations + starts app)"

tunnel:   ## Start Cloudflare Tunnel in foreground (needs ~/.cloudflared/config.yml)
	cloudflared tunnel run info-sentry

tunnel-install: ## Install cloudflared and authenticate with Cloudflare
	brew install cloudflare/cloudflare/cloudflared
	cloudflared tunnel login
	cloudflared tunnel create info-sentry
	@echo ""
	@echo "Next: create ~/.cloudflared/config.yml — see docs/setup.md"

docker-install: ## Install Docker runtime via Homebrew (macOS)
	brew install colima docker docker-compose
	mkdir -p ~/.docker/cli-plugins
	ln -sf /opt/homebrew/lib/docker/cli-plugins/docker-compose ~/.docker/cli-plugins/docker-compose
	colima start --cpu 2 --memory 2 --disk 20
	@echo "✓ Docker ready. Run: make start"

# ── Database (Docker) ─────────────────────────────────────────────────────────
db-up:    ## Start PostgreSQL + ChromaDB containers
	@./scripts/manage.sh db-up

db-down:  ## Stop DB containers (data preserved)
	@./scripts/manage.sh db-down

db-reset: ## ⚠ Destroy all DB volumes (irreversible)
	@./scripts/manage.sh db-reset

db-shell: ## Open a psql shell in the running PostgreSQL container
	docker compose exec postgres psql -U $${POSTGRES_USER:-infosentry} -d infosentry

db-logs:  ## Tail PostgreSQL container logs
	docker compose logs -f postgres

db-generate: ## Regenerate Prisma client after schema changes
	npm run db:generate

db-migrate: ## Apply Prisma migrations (interactive dev mode)
	npm run db:migrate

db-seed:  ## Seed the database with initial data
	npm run db:seed

db-topics: ## Ensure Telegram forum topics exist in the supergroup
	npx tsx scripts/db-query.ts forum-topic ensure-all

# ── Pipeline & agents ─────────────────────────────────────────────────────────
pipeline: ## Run the full news pipeline (scout → analyst → predictor)
	npm run pipeline

scout:    ## Run the news scout (scrape sources)
	npm run scout

github:   ## Run the GitHub scout + analyst for all interests
	npx tsx scripts/github-scout.ts && npx tsx scripts/github-analyst.ts

youtube:  ## Scan YouTube channels + generate video summaries
	npx tsx scripts/scout-youtube.ts && npx tsx scripts/video-analyst.ts

brief:    ## Send personalized daily content brief to Telegram
	npx tsx scripts/daily-brief.ts

weekly:   ## Send weekly intelligence digest to Telegram (run Sundays)
	npx tsx scripts/weekly-digest.ts

decay:    ## Apply 10% score decay to interests idle for ≥14 days
	npx tsx scripts/interest-decay.ts --apply

health:   ## Run the system health check
	npm run health

budget:   ## Show current LLM budget usage
	npm run budget

bot:      ## Start the Telegram bot (foreground)
	npm run bot

# ── Logs ──────────────────────────────────────────────────────────────────────
logs:     ## Tail all background service logs
	@tail -f logs/gateway.log logs/web.log logs/bot.log 2>/dev/null || \
	  echo "No log files found. Start services first: make start"

logs-%:   ## Tail a specific log: make logs-web / logs-bot / logs-gateway
	@tail -f logs/$*.log

# ── Help ──────────────────────────────────────────────────────────────────────
help:     ## Show this help
	@grep -E '^[a-zA-Z_%-]+:.*##' $(MAKEFILE_LIST) | \
	  awk 'BEGIN {FS = ":.*##"}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
