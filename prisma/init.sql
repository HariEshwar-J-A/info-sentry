-- ─────────────────────────────────────────────────────────────
--  Info-Sentry: PostgreSQL initialisation
--  Runs automatically inside Docker on first container start.
--  Safe to re-run (all statements are idempotent).
-- ─────────────────────────────────────────────────────────────

-- Enforce UTF-8 (should already be set by image, belt-and-suspenders)
SET client_encoding = 'UTF8';

-- ── Application roles ────────────────────────────────────────
-- openclaw_role: full access used by the Node.js app + agents
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

-- scout_role: least-privilege read/insert for the scout pipeline
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'scout_role') THEN
    CREATE ROLE scout_role LOGIN PASSWORD 'scout_password';
  END IF;
END $$;

GRANT CONNECT ON DATABASE infosentry TO scout_role;
GRANT USAGE ON SCHEMA public TO scout_role;
GRANT SELECT ON "Interest" TO scout_role;
GRANT SELECT ON "Source" TO scout_role;
GRANT SELECT ON "InterestSource" TO scout_role;
GRANT SELECT, INSERT ON "Article" TO scout_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO scout_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO scout_role;
