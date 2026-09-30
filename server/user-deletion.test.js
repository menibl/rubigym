import assert from 'node:assert/strict';
import test from 'node:test';
import worker from './index.js';
import { hashPassword } from './auth.js';
import { deleteClubUser, removeDeletedUserData } from '../shared/user-deletion.js';
import { recoverUsersFromAccounts } from './user-recovery.js';
import pg from 'pg';
import { createDatabaseStore } from './database.js';

const payload = () => ({
  users: [{ id: 'manager', role: 'MANAGER' }, { id: 'payer', role: 'TRAINEE', familyId: 'f', isFamilyPayer: true, membershipStatus: 'ACTIVE', membershipExpiry: '2027-01-01' }, { id: 'adult', role: 'TRAINEE', familyId: 'f', familyPayerId: 'payer', age: 30 }, { id: 'child', role: 'TRAINEE', familyId: 'f', familyPayerId: 'payer', age: 15 }],
  sessions: [{ id: 's', registeredUsers: ['payer', 'adult'], waitlistUsers: ['payer'], assignedWorkoutPlanId: 'p' }],
  workoutPlans: [{ id: 'p', traineeId: 'payer' }, { id: 'other', traineeId: 'adult' }],
  nutritionPlans: [{ id: 'n', traineeId: 'payer' }],
  messages: [{ id: 'm', senderId: 'payer', receiverId: 'manager' }],
  payments: [{ id: 'pay', traineeId: 'payer' }],
  groupWorkoutPrograms: [{ id: 'g', participants: [{ id: 'payer', name: 'Private' }, { id: 'adult', name: 'Keep' }] }]
});

test('head of family requires an eligible successor and manager cannot be deleted', () => {
  for (const successor of [undefined, 'child', 'outsider']) assert.throws(() => deleteClubUser(payload(), 'payer', 'manager', successor), /ראש משפחה/);
  assert.throws(() => deleteClubUser(payload(), 'manager', 'manager'), /מנהל/);
});
test('deletion transfers family and removes related data while retaining others', () => {
  const next = deleteClubUser(payload(), 'payer', 'manager', 'adult');
  assert.equal(next.users.length, 3);
  assert.equal(next.users.find(user => user.id === 'adult').isFamilyPayer, true);
  assert.equal(next.users.find(user => user.id === 'child').familyPayerId, 'adult');
  assert.equal(next.users.find(user => user.id === 'adult').membershipExpiry, '2027-01-01');
  assert.deepEqual(next.sessions[0].registeredUsers, ['adult']);
  assert.equal(next.sessions[0].assignedWorkoutPlanId, undefined);
  for (const key of ['messages', 'payments', 'nutritionPlans']) assert.equal(next[key].length, 0);
  assert.equal(next.workoutPlans[0].id, 'other');
  assert.equal(next.groupWorkoutPrograms[0].participants.length, 1);
  assert.deepEqual(next.deletedUserIds, ['payer']);
});
test('stale data and account recovery cannot restore deleted users, new IDs remain valid', () => {
  const cleaned = removeDeletedUserData(payload(), ['payer']);
  assert.equal(cleaned.users.some(user => user.id === 'payer'), false);
  assert.equal(recoverUsersFromAccounts(cleaned, [{ user_id: 'payer', role: 'TRAINEE' }]).recoveredUsers.length, 0);
  assert.equal(recoverUsersFromAccounts(cleaned, [{ user_id: 'new-registration', role: 'TRAINEE' }]).recoveredUsers.length, 1);
});

async function fixture(role = 'MANAGER') {
  let deleted = false;
  const managerId = crypto.randomUUID();
  const passwordHash = await hashPassword('test-manager-password');
  const store = {
    async getSession() { return { club_id: 'test', user_id: managerId }; },
    async getAccount() { return { user_id: managerId, role, password_hash: passwordHash }; },
    async getClubState() { return { payload: payload(), revision: 1 }; },
    async deleteClubUser(clubId, target, manager, successor) {
      assert.equal(clubId, 'test'); assert.equal(target, 'payer'); assert.equal(manager, managerId); assert.equal(successor, 'adult'); deleted = true;
    }
  };
  return {
    deleted: () => deleted,
    request: (body = {}) => worker.fetch(new Request('https://club.test/api/admin/delete-user', { method: 'POST', headers: { Cookie: 'baly_session=test', 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: 'payer', confirm: true, successorId: 'adult', password: 'test-manager-password', ...body }) }), { STATE_STORE: store, CLUB_ID: 'test' })
  };
}
test('endpoint denies coach and incorrect password; requires explicit confirmation', async () => {
  const coach = await fixture('COACH'); assert.equal((await coach.request()).status, 403); assert.equal(coach.deleted(), false);
  const manager = await fixture();
  assert.equal((await manager.request({ password: 'wrong' })).status, 403);
  assert.equal((await manager.request({ confirm: false })).status, 400);
  assert.equal((await manager.request({ successorId: '' })).status, 409);
  assert.equal(manager.deleted(), false);
  assert.equal((await manager.request()).status, 200); assert.equal(manager.deleted(), true);
});
test('endpoint rate limits repeated password guesses', async () => {
  const manager = await fixture();
  for (let i = 0; i < 5; i++) assert.equal((await manager.request({ password: 'wrong' })).status, 403);
  assert.equal((await manager.request()).status, 429);
});

test('database deletion revokes sessions, account, push and OTP in one transaction', async t => {
  const queries = [];
  let released = false;
  const client = {
    async query(sql, values) {
      queries.push({ sql, values });
      if (sql.startsWith('SELECT payload')) return { rows: [{ payload: payload() }] };
      if (sql.startsWith('SELECT phone')) return { rows: [{ phone_normalized: '0500000000' }] };
      if (sql.startsWith('SELECT program')) return { rows: [{ program: { id: 'personal-display-p' } }] };
      return { rows: [] };
    },
    release() { released = true; }
  };
  t.mock.method(pg.Pool.prototype, 'query', async () => ({ rows: [] }));
  t.mock.method(pg.Pool.prototype, 'connect', async () => client);
  const store = await createDatabaseStore('postgres://localhost/test');
  await store.deleteClubUser('club', 'payer', 'manager', 'adult');
  assert.equal(queries[0].sql, 'BEGIN');
  assert.equal(queries.at(-1).sql, 'COMMIT');
  for (const table of ['auth_sessions', 'auth_accounts', 'push_subscriptions', 'sms_otp_challenges']) {
    assert.ok(queries.some(query => query.sql.startsWith(`DELETE FROM ${table}`) && query.values[0] === 'club'));
  }
  assert.equal(queries.find(query => query.sql.startsWith('UPDATE live_display')).values[1], null);
  assert.ok(released);
  await store.close();
});

test('database error rolls back the whole deletion', async t => {
  const queries = [];
  t.mock.method(pg.Pool.prototype, 'query', async () => ({ rows: [] }));
  t.mock.method(pg.Pool.prototype, 'connect', async () => ({
    async query(sql) {
      queries.push(sql);
      if (sql.startsWith('SELECT payload')) return { rows: [{ payload: payload() }] };
      if (sql.startsWith('DELETE FROM auth_sessions')) throw new Error('simulated failure');
      return { rows: [] };
    }, release() {}
  }));
  const store = await createDatabaseStore('postgres://localhost/test');
  await assert.rejects(store.deleteClubUser('club', 'payer', 'manager', 'adult'), /simulated failure/);
  assert.equal(queries.at(-1), 'ROLLBACK');
  assert.ok(!queries.includes('COMMIT'));
  await store.close();
});
