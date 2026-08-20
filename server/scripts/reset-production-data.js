import pg from 'pg';
import { resolveDatabaseSsl } from '../database.js';

const { Client } = pg;
const confirmation = 'KEEP_RUBY_BALI_AND_CLEAR_CLUB_DATA';
const clubId = process.env.CLUB_ID || 'baly-wellness';

if (process.env.CONFIRM_PRODUCTION_RESET !== confirmation) {
  console.error(`Reset refused. Set CONFIRM_PRODUCTION_RESET=${confirmation} for this one operation.`);
  process.exit(2);
}

if (!process.env.DATABASE_URL) {
  console.error('Reset refused because DATABASE_URL is not configured.');
  process.exit(2);
}

const collectionKeys = [
  'sessions',
  'openGymSessions',
  'workoutPlans',
  'nutritionPlans',
  'blackPoints',
  'announcements',
  'payments',
  'messages',
  'attendanceLogs',
  'discountCodes',
  'traineeProfiles',
  'traineeMemoryEntries',
  'gymEquipment',
  'coachPdfDocuments',
  'workoutAssistantMessages',
  'workoutAssistantDrafts',
  'groupWorkoutPrograms'
];

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: resolveDatabaseSsl(process.env.DATABASE_URL, process.env.DATABASE_SSL)
});

try {
  await client.connect();
  await client.query('BEGIN');
  await client.query(`CREATE TABLE IF NOT EXISTS club_state_backups (
    id bigserial PRIMARY KEY,
    club_id text NOT NULL,
    payload jsonb NOT NULL,
    revision bigint NOT NULL,
    reason text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`);

  const result = await client.query(
    'SELECT payload, revision FROM club_state WHERE club_id=$1 FOR UPDATE',
    [clubId]
  );
  if (!result.rows.length) throw new Error(`No persisted club state exists for ${clubId}; nothing was changed.`);

  const current = result.rows[0];
  const users = Array.isArray(current.payload?.users) ? current.payload.users : [];
  const ruby = users.find(user => user?.id === 'user-robi')
    || users.find(user => String(user?.name || '').trim() === 'רובי באלי');
  if (!ruby || ruby.role !== 'MANAGER') {
    throw new Error('Ruby Bali manager record was not found; reset was cancelled.');
  }

  const nextPayload = { ...current.payload, users: [ruby] };
  for (const key of collectionKeys) nextPayload[key] = [];

  await client.query(
    'INSERT INTO club_state_backups (club_id,payload,revision,reason) VALUES ($1,$2,$3,$4)',
    [clubId, current.payload, current.revision, 'pre-production-clean-reset']
  );
  await client.query(
    'UPDATE club_state SET payload=$2, revision=revision+1, updated_at=now() WHERE club_id=$1',
    [clubId, nextPayload]
  );
  await client.query('DELETE FROM live_display_commands');
  await client.query('DELETE FROM live_display_status');
  await client.query('DELETE FROM live_display WHERE club_id=$1', [clubId]);
  await client.query('DELETE FROM auth_sessions WHERE club_id=$1', [clubId]);
  await client.query('DELETE FROM auth_accounts WHERE club_id=$1 AND user_id<>$2', [clubId, ruby.id]);
  await client.query('COMMIT');
  console.log(`Production data reset completed for ${clubId}; Ruby Bali was preserved and a backup was created.`);
} catch (error) {
  await client.query('ROLLBACK').catch(() => undefined);
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
