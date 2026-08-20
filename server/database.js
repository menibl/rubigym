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
    async close() { await pool.end(); }
  };
};
