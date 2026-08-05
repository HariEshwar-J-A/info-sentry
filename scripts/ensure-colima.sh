#!/bin/sh
# Watchdog: keeps Colima (Docker VM) running. Loops as a LaunchAgent process.
export HOME=/Users/harieshwar-ai
export PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin

while true; do
  if ! /opt/homebrew/bin/colima status 2>&1 | grep -q "Running"; then
    /opt/homebrew/bin/colima start 2>&1 || true
  fi
  sleep 30
done
