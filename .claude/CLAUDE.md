# Info-Sentry — agent context

Read **[README.md](../README.md)** and **[MEMORY.md](../MEMORY.md)** for full detail. Cursor-specific rules live in **[.cursor/rules/](../.cursor/rules/)**.

## Non-negotiables for this repo

1. **Postgres migration failures (`must be owner of table …`)**  
   `DATABASE_URL` uses `openclaw_role` but tables may be owned by `infosentry`. Do not assume migrate failed because SQL is wrong—run deploy as table owner or apply SQL as `infosentry` then `prisma migrate resolve --applied`. See README “Database migrations”.

2. **Multi-user web**  
   User-scoped data is keyed by **`User.id`** from **`x-user-id`** on the request (set by middleware from the session). Never bake in a single hardcoded owner id for APIs that serve signed-in Google users.

3. **After schema changes**  
   `npx prisma generate` from repo root; **`make db-migrate`** / **`npm run db:migrate`** for migrations; watch ownership if errors persist.
