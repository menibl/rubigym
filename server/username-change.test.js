import test from 'node:test';
import assert from 'node:assert/strict';
import { validateUsernameChange } from '../shared/username-change.js';
import { persistTraineeUsername } from './database.js';
import worker from './index.js';

const users = [{ id: 'u', role: 'TRAINEE', name: 'עדי פנצר', username: 'old-login' },
  { id: 'other', role: 'TRAINEE', username: 'Taken', email: 'other@example.test', phone: '0500000001' }];

test('username edit validates other login identities without changing full name', () => {
  assert.equal(validateUsernameChange(users, 'u', '  Adi-New  '), 'Adi-New');
  for (const value of ['', ' ', 'a'.repeat(81), 'bad\nname', 'TAKEN', 'other@example.test', '0500000001']) {
    assert.throws(() => validateUsernameChange(users, 'u', value));
  }
  assert.throws(() => validateUsernameChange(users, 'missing', 'new'));
  assert.equal(users[0].name, 'עדי פנצר');
});

for (const failed of [false, true]) test(`username persistence commits profile and auth atomically (${failed ? 'rollback' : 'success'})`, async () => {
  const payload = { users, payments: [{ id: 'receipt', amount: 280 }], recurringCheckouts: [{ id: 'existing' }] };
  const calls = []; let released = false;
  const client = { release() { released = true; }, async query(sql, params) {
    calls.push({ sql, params });
    if (sql.startsWith('SELECT payload')) return { rows: [{ payload }] };
    if (sql.startsWith('SELECT user_id')) return { rowCount: 0 };
    if (sql.startsWith('UPDATE auth_accounts')) return { rowCount: 1 };
    if (sql.startsWith('UPDATE club_state') && failed) throw new Error('fixture write failed');
    return { rows: [], rowCount: 1 };
  } };
  const operation = persistTraineeUsername({ connect: async () => client }, 'club', 'u', 'Adi-New');
  if (failed) await assert.rejects(operation, /fixture write failed/);
  else assert.deepEqual(await operation, { username: 'Adi-New' });
  assert.equal(calls.at(-1).sql, failed ? 'ROLLBACK' : 'COMMIT');
  const next = calls.find(call => call.sql.startsWith('UPDATE club_state')).params[1];
  assert.equal(next.users[0].username, 'Adi-New'); assert.equal(next.users[0].name, users[0].name);
  assert.deepEqual(next.payments, payload.payments); assert.deepEqual(next.recurringCheckouts, payload.recurringCheckouts);
  assert.equal(calls.some(call => /password_hash|auth_sessions|DELETE/i.test(call.sql)), false);
  assert.equal(released, true);
});

for (const role of ['MANAGER', 'COACH', 'TRAINEE', null]) test(`username route permission ${role}`, async () => {
  let writes = 0;
  const response = await worker.fetch(new Request('https://club.test/api/admin/trainee-username', {
    method: 'POST', headers: { Cookie: 'baly_session=fixture', Origin: 'https://club.test' }, body: JSON.stringify({ userId: 'u', username: 'new-login' })
  }), { STATE_STORE: { getSession: async () => role ? { club_id: 'baly-wellness', user_id: 'actor' } : null,
    getAccount: async () => ({ user_id: 'actor', role }), getClubState: async () => ({ payload: { users } }),
    renameTraineeUsername: async (_club, id, username) => { writes++; assert.equal(id, 'u'); return { username }; } } });
  assert.equal(response.status, role === 'MANAGER' ? 200 : 403);
  assert.equal(writes, role === 'MANAGER' ? 1 : 0);
});
