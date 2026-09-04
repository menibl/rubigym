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
  profile jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (club_id, user_id),
  UNIQUE (club_id, username_normalized)
);
ALTER TABLE auth_accounts ADD COLUMN IF NOT EXISTS profile jsonb;
CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash text PRIMARY KEY,
  club_id text NOT NULL,
  user_id text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auth_sessions_expiry_idx ON auth_sessions (expires_at);
CREATE TABLE IF NOT EXISTS sms_otp_challenges (
  id text PRIMARY KEY,
  club_id text NOT NULL,
  phone_normalized text NOT NULL,
  purpose text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sms_otp_lookup_idx ON sms_otp_challenges (club_id, phone_normalized, purpose, created_at DESC);
CREATE TABLE IF NOT EXISTS push_subscriptions (
  club_id text NOT NULL,
  user_id text NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  failure_count integer NOT NULL DEFAULT 0,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (club_id, user_id, endpoint)
);
CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON push_subscriptions (club_id, user_id);
CREATE TABLE IF NOT EXISTS push_deliveries (
  club_id text NOT NULL,
  delivery_key text NOT NULL,
  delivered_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (club_id, delivery_key)
);
CREATE INDEX IF NOT EXISTS push_deliveries_time_idx ON push_deliveries (delivered_at);
CREATE TABLE IF NOT EXISTS landing_media (
  club_id text NOT NULL,
  slot text NOT NULL CHECK (slot IN ('hero', 'coaching')),
  mime_type text NOT NULL,
  body bytea NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (club_id, slot)
);
