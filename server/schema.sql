-- Persistent production storage for BALY WELLNESS.
-- Applied automatically by server/database.js; kept here for review and managed migrations.
CREATE TABLE IF NOT EXISTS club_state (
  club_id text PRIMARY KEY,
  payload jsonb NOT NULL,
  revision bigint NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS live_display (
  club_id text PRIMARY KEY,
  program jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS live_display_commands (
  program_id text PRIMARY KEY,
  command jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS live_display_status (
  program_id text PRIMARY KEY,
  status jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
