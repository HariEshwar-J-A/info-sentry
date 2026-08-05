#!/bin/sh
# Shell wrapper for the Telegram bot — avoids macOS TCC EPERM on ESM tsx symlink
export HOME=/Users/harieshwar-ai
export PATH=/opt/homebrew/opt/node@22/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin
export NODE_ENV=production
cd /Users/harieshwar-ai/Documents/code/info-sentry
exec /opt/homebrew/opt/node@22/bin/node \
  /Users/harieshwar-ai/Documents/code/info-sentry/node_modules/tsx/dist/cli.mjs \
  scripts/telegram-bot.ts
