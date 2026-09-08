import assert from 'node:assert/strict';
import test from 'node:test';
import worker from './index.js';
import { createPhoneVerificationToken } from './sms-auth.js';

test('verified registration phone creates a durable blocked account and session', async () => {
  let state = { payload: { users: [], payments: [], messages: [] }, revision: 1 };
  const challenges = [];
  const accounts = [];
  const sessions = [];
  const store = {
    async getAccountByLogin() { return null; },
    async getClubState() { return state; },
    async putClubState(_clubId, payload, expectedRevision) {
      assert.equal(expectedRevision, state.revision);
      state = { payload, revision: state.revision + 1 };
      return { conflict: false, revision: state.revision };
    },
    async upsertAccount(account) { accounts.push(account); },
    async createSession(tokenHash, clubId, userId, expiresAt) { sessions.push({ tokenHash, clubId, userId, expiresAt }); },
    async getSession(tokenHash) {
      const session = sessions.find(candidate => candidate.tokenHash === tokenHash);
      return session ? { club_id: session.clubId, user_id: session.userId, expires_at: session.expiresAt } : null;
    },
    async getAccount(clubId, userId) {
      const account = accounts.find(candidate => candidate.clubId === clubId && candidate.userId === userId);
      return account ? { user_id: account.userId, role: account.role, profile: account.profile } : null;
    },
    async getOtpRequestStats() { return { requestsLastHour: challenges.length, lastRequestedAt: null }; },
    async createOtpChallenge(challenge) {
      challenges.push({ ...challenge, attempts: 0, max_attempts: challenge.maxAttempts, expires_at: challenge.expiresAt, consumed_at: null });
    },
    async getLatestOtpChallenge() { return challenges.at(-1) || null; },
    async consumeOtpChallenge(id, expectedHash) {
      const challenge = challenges.find(item => item.id === id);
      challenge.attempts += 1;
      if (challenge.codeHash !== expectedHash) return false;
      challenge.consumed_at = new Date();
      return true;
    }
  };
  const env = {
    CLUB_ID: 'test-club',
    STATE_STORE: store,
    SMS_TEST_MODE: 'true',
    SMS_OTP_SIGNING_SECRET: 'partial-registration-test-signing-secret-value'
  };
  const requestCodeResponse = await worker.fetch(new Request('https://balywellness.test/api/auth/request-phone-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '0541234567', purpose: 'REGISTER' })
  }), env);
  assert.equal(requestCodeResponse.status, 202);

  const response = await worker.fetch(new Request('https://balywellness.test/api/auth/verify-registration-phone', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '0541234567', otp: '1111' })
  }), env);
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.verified, true);
  assert.equal(payload.user.registrationIncomplete, true);
  assert.equal(payload.registrationUserId, payload.user.id);
  assert.match(response.headers.get('Set-Cookie') || '', /^baly_session=/);
  assert.equal(state.payload.users.length, 1);
  assert.equal(accounts[0].profile.registrationIncomplete, true);
  assert.equal(sessions[0].userId, payload.user.id);

  const cookie = (response.headers.get('Set-Cookie') || '').split(';')[0];
  const sessionResponse = await worker.fetch(new Request('https://balywellness.test/api/auth/session', { headers: { Cookie: cookie } }), env);
  assert.equal(sessionResponse.status, 200);
  const stateResponse = await worker.fetch(new Request('https://balywellness.test/api/state', { headers: { Cookie: cookie } }), env);
  assert.equal(stateResponse.status, 401);

  const completedUser = {
    ...payload.user,
    name: 'Completed Trainee',
    username: 'completed-trainee',
    email: 'completed@example.com',
    password: 'completed-password',
    registrationIncomplete: false
  };
  const completionResponse = await worker.fetch(new Request('https://balywellness.test/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ user: completedUser, payment: { id: 'payment-completed', status: 'PAID' } })
  }), env);
  assert.equal(completionResponse.status, 201);
  assert.equal(state.payload.users.length, 1);
  assert.equal(state.payload.users[0].name, 'Completed Trainee');
  assert.equal(state.payload.users[0].registrationIncomplete, false);
  assert.ok(state.payload.users[0].registrationCompletedAt);
  assert.equal(accounts.at(-1).profile.registrationIncomplete, false);
});

test('family registration creates separate login accounts without storing plaintext passwords', async () => {
  let state = { payload: { users: [], payments: [] }, revision: 1 };
  const accounts = [];
  const store = {
    async getAccountByLogin() { return null; },
    async getClubState() { return state; },
    async putClubState(_clubId, payload, expectedRevision) {
      assert.equal(expectedRevision, state.revision);
      state = { payload, revision: state.revision + 1 };
      return { conflict: false, revision: state.revision };
    },
    async upsertAccount(account) { accounts.push(account); },
    async createSession() {}
  };
  const payer = {
    id: 'payer-1', name: 'Parent', username: 'parent', email: 'parent@example.com', phone: '0500000001',
    password: 'parent-password', role: 'TRAINEE', isFamilyPayer: true, familyId: 'family-1', familyMembersCount: 2
  };
  const member = {
    id: 'member-1', name: 'Child', username: 'child', email: 'parent@example.com', phone: '',
    password: 'child-password', role: 'TRAINEE', familyPayerId: payer.id, familyId: payer.familyId
  };
  const env = { SMS_OTP_SIGNING_SECRET: 'family-registration-test-signing-secret-value', CLUB_ID: 'test-club' };
  const phoneVerificationToken = await createPhoneVerificationToken({ env, clubId: env.CLUB_ID, phone: payer.phone });

  const response = await worker.fetch(new Request('https://balywellness.test/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: payer, familyUsers: [member], payment: { id: 'payment-1', status: 'PAID' }, phoneVerificationToken })
  }), { STATE_STORE: store, ...env });

  assert.equal(response.status, 201);
  assert.equal(state.payload.users.length, 2);
  assert.equal(accounts.length, 2);
  assert.equal(state.payload.users.some(user => 'password' in user), false);
  assert.equal(accounts.every(account => account.passwordHash && !account.passwordHash.includes('password')), true);
  assert.equal(accounts.every(account => account.profile && !('password' in account.profile)), true);
  assert.deepEqual(accounts.map(account => account.profile.name), ['Parent', 'Child']);
  assert.deepEqual(accounts.map(account => account.profile.email), ['parent@example.com', 'parent@example.com']);
});
