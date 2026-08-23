import pg from 'pg';

const { Pool } = pg;

const disabledSslModes = new Set(['0', 'disable', 'false', 'no']);
const enabledSslModes = new Set(['1', 'require', 'true', 'yes']);
const localDatabaseHosts = new Set(['127.0.0.1', '::1', 'localhost', 'postgres']);

export const resolveDatabaseSsl = (databaseUrl, configuredMode) => {
  const mode = configuredMode?.trim().toLowerCase();
  if (disabledSslModes.has(mode)) return false;
  if (enabledSslModes.has(mode)) return { rejectUnauthorized: false };
  if (mode) throw new Error('DATABASE_SSL must be true/require or false/disable.');

  const hostname = new URL(databaseUrl).hostname.toLowerCase();
  return localDatabaseHosts.has(hostname) ? false : { rejectUnauthorized: false };
};

export const createDatabaseStore = async (databaseUrl, databaseSsl) => {
  if (!databaseUrl) return null;
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 5,
    ssl: resolveDatabaseSsl(databaseUrl, databaseSsl),
  });
  await pool.query(`
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
  `);
  return {
    async getClubState(clubId) {
      const result = await pool.query('SELECT payload, revision, updated_at FROM club_state WHERE club_id=$1', [clubId]);
      return result.rows[0] || null;
    },
    async putClubState(clubId, payload, expectedRevision) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const current = await client.query('SELECT revision FROM club_state WHERE club_id=$1 FOR UPDATE', [clubId]);
        const revision = Number(current.rows[0]?.revision || 0);
        if (expectedRevision !== undefined && revision !== Number(expectedRevision)) {
          await client.query('ROLLBACK');
          return { conflict: true, revision };
        }
        const nextRevision = revision + 1;
        await client.query(`INSERT INTO club_state (club_id,payload,revision) VALUES ($1,$2,$3)
          ON CONFLICT (club_id) DO UPDATE SET payload=EXCLUDED.payload,revision=EXCLUDED.revision,updated_at=now()`, [clubId, payload, nextRevision]);
        await client.query('COMMIT');
        return { conflict: false, revision: nextRevision };
      } finally { client.release(); }
    },
    async getLandingMedia(clubId, slot) {
      const result = await pool.query(
        'SELECT mime_type, body, updated_at FROM landing_media WHERE club_id=$1 AND slot=$2',
        [clubId, slot]
      );
      return result.rows[0] || null;
    },
    async listLandingMedia(clubId) {
      const result = await pool.query(
        'SELECT slot, mime_type, octet_length(body) AS size, updated_at FROM landing_media WHERE club_id=$1',
        [clubId]
      );
      return result.rows;
    },
    async putLandingMedia(clubId, slot, mimeType, body) {
      const result = await pool.query(`INSERT INTO landing_media (club_id,slot,mime_type,body)
        VALUES ($1,$2,$3,$4)
        ON CONFLICT (club_id,slot) DO UPDATE SET mime_type=EXCLUDED.mime_type,body=EXCLUDED.body,updated_at=now()
        RETURNING mime_type,octet_length(body) AS size,updated_at`, [clubId, slot, mimeType, body]);
      return result.rows[0];
    },
    async deleteLandingMedia(clubId, slot) {
      await pool.query('DELETE FROM landing_media WHERE club_id=$1 AND slot=$2', [clubId, slot]);
    },
    async getActiveProgram(clubId) {
      const result = await pool.query('SELECT program FROM live_display WHERE club_id=$1', [clubId]);
      return result.rows[0]?.program || null;
    },
    async setActiveProgram(clubId, program) {
      await pool.query(`INSERT INTO live_display (club_id,program) VALUES ($1,$2)
        ON CONFLICT (club_id) DO UPDATE SET program=EXCLUDED.program,updated_at=now()`, [clubId, program]);
    },
    async getCommand(programId) {
      const result = await pool.query('SELECT command FROM live_display_commands WHERE program_id=$1', [programId]);
      return result.rows[0]?.command || null;
    },
    async setCommand(programId, command) {
      await pool.query(`INSERT INTO live_display_commands (program_id,command) VALUES ($1,$2)
        ON CONFLICT (program_id) DO UPDATE SET command=EXCLUDED.command,updated_at=now()`, [programId, command]);
    },
    async getStatus(programId) {
      const result = await pool.query('SELECT status FROM live_display_status WHERE program_id=$1', [programId]);
      return result.rows[0]?.status || null;
    },
    async setStatus(programId, status) {
      await pool.query(`INSERT INTO live_display_status (program_id,status) VALUES ($1,$2)
        ON CONFLICT (program_id) DO UPDATE SET status=EXCLUDED.status,updated_at=now()`, [programId, status]);
    },
    async getAccountByLogin(clubId, login) {
      const normalized = String(login || '').trim().toLowerCase();
      const phone = normalized.replace(/\D/g, '');
      const result = await pool.query(`SELECT * FROM auth_accounts
        WHERE club_id=$1 AND (username_normalized=$2 OR email_normalized=$2 OR ($3 <> '' AND phone_normalized=$3))
        LIMIT 1`, [clubId, normalized, phone]);
      return result.rows[0] || null;
    },
    async getAccount(clubId, userId) {
      const result = await pool.query('SELECT * FROM auth_accounts WHERE club_id=$1 AND user_id=$2', [clubId, userId]);
      return result.rows[0] || null;
    },
    async upsertAccount(account) {
      await pool.query(`INSERT INTO auth_accounts
        (club_id,user_id,username_normalized,email_normalized,phone_normalized,password_hash,role)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (club_id,user_id) DO UPDATE SET
          username_normalized=EXCLUDED.username_normalized,
          email_normalized=EXCLUDED.email_normalized,
          phone_normalized=EXCLUDED.phone_normalized,
          password_hash=EXCLUDED.password_hash,
          role=EXCLUDED.role,
          updated_at=now()`, [account.clubId, account.userId, account.username, account.email || null, account.phone || null, account.passwordHash, account.role]);
    },
    async updateAccountIdentity(clubId, user) {
      await pool.query(`UPDATE auth_accounts SET
        username_normalized=$3,email_normalized=$4,phone_normalized=$5,role=$6,updated_at=now()
        WHERE club_id=$1 AND user_id=$2`, [clubId, user.id, String(user.username || user.email || user.phone || '').trim().toLowerCase(), String(user.email || '').trim().toLowerCase() || null, String(user.phone || '').replace(/\D/g, '') || null, user.role]);
    },
    async updatePassword(clubId, userId, passwordHash) {
      await pool.query('UPDATE auth_accounts SET password_hash=$3,updated_at=now() WHERE club_id=$1 AND user_id=$2', [clubId, userId, passwordHash]);
    },
    async createSession(tokenHash, clubId, userId, expiresAt) {
      await pool.query('DELETE FROM auth_sessions WHERE expires_at <= now()');
      await pool.query('INSERT INTO auth_sessions (token_hash,club_id,user_id,expires_at) VALUES ($1,$2,$3,$4)', [tokenHash, clubId, userId, expiresAt]);
    },
    async getSession(tokenHash) {
      const result = await pool.query(`SELECT club_id,user_id,expires_at FROM auth_sessions
        WHERE token_hash=$1 AND expires_at > now()`, [tokenHash]);
      return result.rows[0] || null;
    },
    async deleteSession(tokenHash) {
      await pool.query('DELETE FROM auth_sessions WHERE token_hash=$1', [tokenHash]);
    },
    async getOtpRequestStats(clubId, phone, purpose) {
      const result = await pool.query(`SELECT
        count(*) FILTER (WHERE created_at > now() - interval '1 hour')::integer AS requests_last_hour,
        max(created_at) AS last_requested_at
        FROM sms_otp_challenges WHERE club_id=$1 AND phone_normalized=$2 AND purpose=$3`, [clubId, phone, purpose]);
      return {
        requestsLastHour: Number(result.rows[0]?.requests_last_hour || 0),
        lastRequestedAt: result.rows[0]?.last_requested_at || null
      };
    },
    async createOtpChallenge(challenge) {
      await pool.query("DELETE FROM sms_otp_challenges WHERE created_at < now() - interval '24 hours'");
      await pool.query(`INSERT INTO sms_otp_challenges
        (id,club_id,phone_normalized,purpose,code_hash,expires_at,max_attempts)
        VALUES ($1,$2,$3,$4,$5,$6,$7)`, [challenge.id, challenge.clubId, challenge.phone, challenge.purpose, challenge.codeHash, challenge.expiresAt, challenge.maxAttempts]);
    },
    async getLatestOtpChallenge(clubId, phone, purpose) {
      const result = await pool.query(`SELECT id,code_hash,expires_at,attempts,max_attempts,consumed_at
        FROM sms_otp_challenges WHERE club_id=$1 AND phone_normalized=$2 AND purpose=$3
        ORDER BY created_at DESC LIMIT 1`, [clubId, phone, purpose]);
      return result.rows[0] || null;
    },
    async consumeOtpChallenge(id, expectedHash) {
      const result = await pool.query(`UPDATE sms_otp_challenges SET
        attempts=attempts+1,
        consumed_at=CASE WHEN code_hash=$2 THEN now() ELSE consumed_at END
        WHERE id=$1 AND consumed_at IS NULL AND expires_at > now() AND attempts < max_attempts
        RETURNING code_hash=$2 AS verified`, [id, expectedHash]);
      return result.rows[0]?.verified === true;
    },
    async invalidateOtpChallenge(id) {
      await pool.query('UPDATE sms_otp_challenges SET consumed_at=now() WHERE id=$1', [id]);
    },
    async upsertPushSubscription(clubId, userId, subscription, userAgent) {
      await pool.query(`INSERT INTO push_subscriptions (club_id,user_id,endpoint,p256dh,auth,user_agent)
        VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT (club_id,user_id,endpoint) DO UPDATE SET
          p256dh=EXCLUDED.p256dh,auth=EXCLUDED.auth,user_agent=EXCLUDED.user_agent,updated_at=now()`,
      [clubId, userId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth, userAgent || null]);
    },
    async deletePushSubscription(clubId, userId, endpoint) {
      await pool.query('DELETE FROM push_subscriptions WHERE club_id=$1 AND user_id=$2 AND ($3::text IS NULL OR endpoint=$3)', [clubId, userId, endpoint || null]);
    },
    async getPushSubscriptions(clubId, userIds) {
      if (!userIds.length) return [];
      const result = await pool.query(`SELECT user_id,endpoint,p256dh,auth FROM push_subscriptions
        WHERE club_id=$1 AND user_id = ANY($2::text[])`, [clubId, userIds]);
      return result.rows;
    },
    async claimPushDelivery(clubId, deliveryKey) {
      const result = await pool.query(`INSERT INTO push_deliveries (club_id,delivery_key) VALUES ($1,$2)
        ON CONFLICT DO NOTHING RETURNING delivery_key`, [clubId, deliveryKey]);
      return result.rowCount === 1;
    },
    async releasePushDelivery(clubId, deliveryKey) {
      await pool.query('DELETE FROM push_deliveries WHERE club_id=$1 AND delivery_key=$2', [clubId, deliveryKey]);
    },
    async getAllClubStates() {
      const result = await pool.query('SELECT club_id,payload FROM club_state');
      return result.rows;
    },
    async close() { await pool.end(); }
  };
};
