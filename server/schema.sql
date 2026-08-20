-- Persistent production storage for BALY WELLNESS.
-- Applied automatically by server/database.js; kept here for review and managed migrations.
CREATE TABLE IF NOT EXISTS club_state (
  club_id text PRIMARY KEY,
  payload jsonb NOT NULL,
  revision bigint NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS club_state_backups (
  id bigserial PRIMARY KEY,
  club_id text NOT NULL,
  payload jsonb NOT NULL,
  revision bigint NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
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
CREATE TABLE IF NOT EXISTS auth_accounts (
  club_id text NOT NULL,
  user_id text NOT NULL,
  username_normalized text NOT NULL,
  email_normalized text,
  phone_normalized text,
  password_hash text NOT NULL,
  role text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (club_id, user_id),
  UNIQUE (club_id, username_normalized)
);
CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash text PRIMARY KEY,
  club_id text NOT NULL,
  user_id text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auth_sessions_expiry_idx ON auth_sessions (expires_at);
