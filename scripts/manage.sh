#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
#  Info-Sentry service manager
#  Usage: ./scripts/manage.sh <start|stop|restart|status|dev>
# ─────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_DIR="$ROOT/.pids"
LOG_DIR="$ROOT/logs"

mkdir -p "$PID_DIR" "$LOG_DIR"

# ── Colours ───────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; RESET='\033[0m'
ok()   { echo -e "${GREEN}✓${RESET} $*"; }
warn() { echo -e "${YELLOW}!${RESET} $*"; }
err()  { echo -e "${RED}✗${RESET} $*"; }

# ── Helpers ───────────────────────────────────────────────
pid_file() { echo "$PID_DIR/$1.pid"; }

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

  # Run in background, redirect output to log
  "$@" >> "$logfile" 2>&1 &
  local pid=$!
  echo "$pid" > "$(pid_file "$name")"
  ok "$name started (PID $pid) — logs: logs/$name.log"
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
  # Wait up to 5 s for clean exit
  local i=0
  while kill -0 "$pid" 2>/dev/null && (( i < 10 )); do sleep 0.5; (( i++ )); done
  kill -9 "$pid" 2>/dev/null || true
  rm -f "$f"
  ok "$name stopped (was PID $pid)"
}

# ── Commands ──────────────────────────────────────────────
cmd_start() {
  echo "Starting Info-Sentry services..."
  start_service gateway  openclaw --profile info-sentry gateway --port 18790
  start_service web      npm run --prefix "$ROOT/web" start
  start_service bot      npx --prefix "$ROOT" tsx "$ROOT/scripts/telegram-bot.ts"
  echo ""
  echo "All services started. Run './scripts/manage.sh status' to check."
  echo "Stop with: ./scripts/manage.sh stop   (or: make stop)"
}

cmd_stop() {
  echo "Stopping Info-Sentry services..."
  stop_service bot
  stop_service web
  stop_service gateway
  ok "All services stopped."
}

cmd_restart() {
  cmd_stop
  echo ""
  cmd_start
}

cmd_status() {
  echo "Info-Sentry service status:"
  echo "────────────────────────────"
  for svc in gateway web bot; do
    local f; f="$(pid_file "$svc")"
    if is_running "$svc"; then
      local pid; pid="$(cat "$f")"
      echo -e "  ${GREEN}● running${RESET}  $svc (PID $pid)"
    else
      echo -e "  ${RED}○ stopped${RESET}  $svc"
    fi
  done
  echo ""
  # Port check
  for port in 18790 3001; do
    if lsof -i ":$port" -sTCP:LISTEN -t &>/dev/null; then
      echo -e "  ${GREEN}●${RESET} port $port listening"
    else
      echo -e "  ${RED}○${RESET} port $port not listening"
    fi
  done
}

cmd_dev() {
  echo "Starting Info-Sentry in DEV mode (Ctrl+C stops everything)..."
  # Uses concurrently — installed as devDependency
  exec npx --prefix "$ROOT" concurrently \
    --kill-others \
    --names "gateway,web,bot" \
    --prefix-colors "yellow,cyan,magenta" \
    "openclaw --profile info-sentry gateway --port 18790" \
    "npm --prefix '$ROOT/web' run dev" \
    "npx tsx watch '$ROOT/scripts/telegram-bot.ts'"
}

# ── Dispatch ──────────────────────────────────────────────
case "${1:-help}" in
  start)   cmd_start   ;;
  stop)    cmd_stop    ;;
  restart) cmd_restart ;;
  status)  cmd_status  ;;
  dev)     cmd_dev     ;;
  *)
    echo "Usage: $(basename "$0") <command>"
    echo ""
    echo "Commands:"
    echo "  start    Start all services in the background"
    echo "  stop     Stop all background services"
    echo "  restart  Stop then start all services"
    echo "  status   Show running/stopped status + port check"
    echo "  dev      Start all in foreground (Ctrl+C kills all)"
    exit 1
    ;;
esac
