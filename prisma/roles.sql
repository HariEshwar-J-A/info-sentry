-- ================================================================
-- Info-Sentry: PostgreSQL Role Definitions
-- Run this AFTER the database and tables are created.
-- It is also mounted into docker-entrypoint-initdb.d for auto-run.
-- ================================================================

-- ─── OpenClaw Role (full access) ────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'openclaw_role') THEN
    CREATE ROLE openclaw_role LOGIN PASSWORD 'openclaw_password';
  END IF;
END $$;

GRANT ALL PRIVILEGES ON DATABASE infosentry TO openclaw_role;
GRANT ALL PRIVILEGES ON SCHEMA public TO openclaw_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO openclaw_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO openclaw_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO openclaw_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO openclaw_role;

-- ─── Scout Role (restricted access) ────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'scout_role') THEN
    CREATE ROLE scout_role LOGIN PASSWORD 'scout_password';
  END IF;
END $$;

GRANT CONNECT ON DATABASE infosentry TO scout_role;
GRANT USAGE ON SCHEMA public TO scout_role;

-- Scout can SELECT on Interest, Source, InterestSource (read-only)
GRANT SELECT ON "Interest" TO scout_role;
GRANT SELECT ON "Source" TO scout_role;
GRANT SELECT ON "InterestSource" TO scout_role;

-- Scout can SELECT + INSERT on Article (write new articles, check duplicates)
GRANT SELECT, INSERT ON "Article" TO scout_role;

-- Scout needs sequence access for cuid generation on Article inserts
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO scout_role;

-- Ensure future tables also get SELECT for scout (safety net)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO scout_role;
