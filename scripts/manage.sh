#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  Info-Sentry service manager
#  Usage: ./scripts/manage.sh <start|stop|restart|status|dev|db-up|db-down>
# ─────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_DIR="$ROOT/.pids"
LOG_DIR="$ROOT/logs"

mkdir -p "$PID_DIR" "$LOG_DIR"

# ── Colours ───────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; RESET='\033[0m'
ok()    { echo -e "${GREEN}✓${RESET} $*"; }
info()  { echo -e "${CYAN}→${RESET} $*"; }
warn()  { echo -e "${YELLOW}!${RESET} $*"; }
err()   { echo -e "${RED}✗${RESET} $*"; }

# ── Docker / Colima helpers ───────────────────────────────────
DOCKER_BIN="${DOCKER:-docker}"

docker_available() {
  command -v "$DOCKER_BIN" &>/dev/null
}

colima_running() {
  command -v colima &>/dev/null && colima status 2>/dev/null | grep -q "running"
}

ensure_docker_runtime() {
  # Ensure lima/colima binaries are in PATH (Homebrew arm64 path)
  export PATH="/opt/homebrew/bin:/opt/homebrew/Cellar/lima/2.1.1/bin:$PATH"

  if ! docker_available; then
    err "docker not found. Install via: make docker-install"
    exit 1
  fi

  # If Colima is installed and not running, start it
  if command -v colima &>/dev/null && ! colima_running; then
    info "Starting Colima (Docker VM)…"
    colima start --cpu 2 --memory 2 --disk 20 --runtime docker 2>&1 | tail -3
    ok "Colima started"
  fi

  # Test docker daemon is reachable
  if ! "$DOCKER_BIN" info &>/dev/null 2>&1; then
    err "Docker daemon not reachable. Run: colima start"
    exit 1
  fi
}

# ── DB helpers ────────────────────────────────────────────────
cmd_db_up() {
  ensure_docker_runtime
  info "Starting database services (PostgreSQL + ChromaDB)…"

  if [ ! -f "$ROOT/.env" ]; then
    err ".env not found — copy .env.example to .env and set POSTGRES_PASSWORD"
    exit 1
  fi

  # Validate required secret
  source "$ROOT/.env" 2>/dev/null || true
  if [ -z "${POSTGRES_PASSWORD:-}" ]; then
    err "POSTGRES_PASSWORD is not set in .env"
    exit 1
  fi

  "$DOCKER_BIN" compose --env-file "$ROOT/.env" -f "$ROOT/docker-compose.yml" up -d
  ok "Database containers started"

  # Wait for Postgres to be healthy
  info "Waiting for PostgreSQL to be ready…"
  local attempts=0
  until "$DOCKER_BIN" compose -f "$ROOT/docker-compose.yml" exec -T postgres \
        pg_isready -U "${POSTGRES_USER:-infosentry}" -d infosentry &>/dev/null; do
    attempts=$((attempts+1))
    if (( attempts > 30 )); then
      err "PostgreSQL did not become ready in time"
      exit 1
    fi
    sleep 2
  done
  ok "PostgreSQL ready"
}

cmd_db_down() {
  ensure_docker_runtime
  info "Stopping database services…"
  "$DOCKER_BIN" compose -f "$ROOT/docker-compose.yml" down
  ok "Database containers stopped (data volumes preserved)"
}

cmd_db_reset() {
  ensure_docker_runtime
  warn "This will DESTROY all data. Type 'yes' to confirm:"
  read -r confirm
  if [ "$confirm" != "yes" ]; then echo "Aborted."; exit 0; fi
  "$DOCKER_BIN" compose -f "$ROOT/docker-compose.yml" down --volumes
  ok "Data volumes destroyed"
}

# ── App process helpers ───────────────────────────────────────
pid_file()  { echo "$PID_DIR/$1.pid"; }

is_running() {
  local f; f="$(pid_file "$1")"
  [[ -f "$f" ]] && kill -0 "$(cat "$f")" 2>/dev/null
}

start_service() {
  local name="$1"; shift
  local logfile="$LOG_DIR/$name.log"

  if is_running "$name"; then
    warn "$name already running (PID $(cat "$(pid_file "$name")"))"
    return 0
  fi

  "$@" >> "$logfile" 2>&1 &
  echo $! > "$(pid_file "$name")"
  ok "$name started (PID $!) — logs: logs/$name.log"
}

stop_service() {
  local name="$1"
  local f; f="$(pid_file "$name")"

  if ! is_running "$name"; then
    warn "$name is not running"
    [[ -f "$f" ]] && rm -f "$f"
    return 0
  fi

  local pid; pid="$(cat "$f")"
  kill "$pid" 2>/dev/null || true
  local i=0
  while kill -0 "$pid" 2>/dev/null && (( i < 10 )); do sleep 0.5; (( i++ )); done
  kill -9 "$pid" 2>/dev/null || true
  rm -f "$f"
  ok "$name stopped (was PID $pid)"
}

# ── Commands ──────────────────────────────────────────────────
cmd_start() {
  # 1. Start DB containers first
  cmd_db_up

  # 2. Run Prisma migrations (idempotent — safe to run every time)
  info "Applying database migrations…"
  npx --prefix "$ROOT" prisma migrate deploy 2>&1 | tail -3
  ok "Migrations up to date"

  echo ""
  info "Starting application services…"
  start_service gateway  openclaw --profile info-sentry gateway --port 18790
  start_service web      npm run --prefix "$ROOT/web" start
  start_service bot      npx --prefix "$ROOT" tsx "$ROOT/scripts/telegram-bot.ts"

  # 3. Start Cloudflare Tunnel if configured
  if command -v cloudflared &>/dev/null && [ -f "$HOME/.cloudflared/config.yml" ]; then
    start_service tunnel cloudflared tunnel run info-sentry
    ok "Cloudflare Tunnel started"
  fi

  echo ""
  ok "All services running."
  echo "   Local: http://localhost:3001"
  if command -v cloudflared &>/dev/null && [ -f "$HOME/.cloudflared/config.yml" ]; then
    echo "   Public: check your Cloudflare tunnel hostname"
  fi
  echo "   Stop: ./scripts/manage.sh stop  (or: make stop)"
}

cmd_stop() {
  info "Stopping application services…"
  stop_service tunnel
  stop_service bot
  stop_service web
  stop_service gateway

  echo ""
  info "Stopping database containers…"
  cmd_db_down
}

cmd_restart() {
  cmd_stop
  echo ""
  cmd_start
}

cmd_status() {
  echo "Info-Sentry status"
  echo "────────────────────────────────"

  # App processes
  for svc in gateway web bot; do
    if is_running "$svc"; then
      local pid; pid="$(cat "$(pid_file "$svc")")"
      echo -e "  ${GREEN}● running${RESET}  $svc (PID $pid)"
    else
      echo -e "  ${RED}○ stopped${RESET}  $svc"
    fi
  done

  echo ""

  # Docker containers
  if docker_available && (colima_running || "$DOCKER_BIN" info &>/dev/null 2>&1); then
    "$DOCKER_BIN" compose -f "$ROOT/docker-compose.yml" ps --format \
      "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || true
  else
    echo -e "  ${YELLOW}!${RESET} Docker not running"
  fi

  echo ""

  # Port check
  for port in 18790 3001 5432 8000; do
    if lsof -i ":$port" -sTCP:LISTEN -t &>/dev/null; then
      echo -e "  ${GREEN}●${RESET} :$port listening"
    else
      echo -e "  ${RED}○${RESET} :$port not listening"
    fi
  done
}

cmd_dev() {
  # Start DB first, then all app services via concurrently
  cmd_db_up

  info "Applying migrations…"
  npx --prefix "$ROOT" prisma migrate deploy 2>&1 | tail -3

  echo ""
  info "Starting all services in DEV mode (Ctrl+C stops everything)…"

  TUNNEL_CMD=""
  if command -v cloudflared &>/dev/null && [ -f "$HOME/.cloudflared/config.yml" ]; then
    TUNNEL_CMD="cloudflared tunnel run info-sentry"
  fi

  if [ -n "$TUNNEL_CMD" ]; then
    exec npx --prefix "$ROOT" concurrently \
      --kill-others \
      --names "gateway,web,bot,tunnel" \
      --prefix-colors "yellow,cyan,magenta,green" \
      "openclaw --profile info-sentry gateway --port 18790" \
      "npm --prefix '$ROOT/web' run dev" \
      "npx tsx watch '$ROOT/scripts/telegram-bot.ts'" \
      "$TUNNEL_CMD"
  else
    exec npx --prefix "$ROOT" concurrently \
      --kill-others \
      --names "gateway,web,bot" \
      --prefix-colors "yellow,cyan,magenta" \
      "openclaw --profile info-sentry gateway --port 18790" \
      "npm --prefix '$ROOT/web' run dev" \
      "npx tsx watch '$ROOT/scripts/telegram-bot.ts'"
  fi
}

# ── Dispatch ──────────────────────────────────────────────────
case "${1:-help}" in
  start)    cmd_start   ;;
  stop)     cmd_stop    ;;
  restart)  cmd_restart ;;
  status)   cmd_status  ;;
  dev)      cmd_dev     ;;
  db-up)    cmd_db_up   ;;
  db-down)  cmd_db_down ;;
  db-reset) cmd_db_reset ;;
  *)
    echo "Usage: $(basename "$0") <command>"
    echo ""
    echo "Lifecycle:"
    echo "  start     Start DB containers + app services (background)"
    echo "  stop      Stop app services + DB containers"
    echo "  restart   stop + start"
    echo "  status    Show status for all services + ports"
    echo "  dev       Start everything in foreground (Ctrl+C kills all)"
    echo ""
    echo "Database:"
    echo "  db-up     Start PostgreSQL + ChromaDB containers only"
    echo "  db-down   Stop containers (data preserved)"
    echo "  db-reset  ⚠ Destroy all data volumes"
    exit 1
    ;;
esac
