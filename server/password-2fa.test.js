import assert from 'node:assert/strict';
import test from 'node:test';
import worker from './index.js';
import { hashPassword } from './auth.js';

const signingSecret = 'password-second-factor-test-signing-secret-value';

const createStore = async () => {
  const challenges = [];
  const sessions = [];
  const account = {
    user_id: 'trainee-1',
    phone_normalized: '0546995885',
    password_hash: await hashPassword('correct-password')
  };
  return {
    challenges,
    sessions,
    async getAccountByLogin(_clubId, login) { return login === 'trainee' ? account : null; },
    async getClubState() {
      return { payload: { users: [{ id: 'trainee-1', name: 'Trainee', phone: '054-6995885', role: 'TRAINEE' }] }, revision: 1 };
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
    },
    async createSession(tokenHash, clubId, userId, expiresAt) { sessions.push({ tokenHash, clubId, userId, expiresAt }); }
  };
};

const requestLogin = (body, store) => worker.fetch(new Request('https://balywellness.test/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
}), {
  CLUB_ID: 'test-club',
  STATE_STORE: store,
  SMS_TEST_MODE: 'true',
  SMS_OTP_SIGNING_SECRET: signingSecret
});

test('password login creates a session without sending an SMS challenge', async () => {
  const store = await createStore();

  const response = await requestLogin({ login: 'trainee', password: 'correct-password' }, store);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('Set-Cookie') || '', /^baly_session=/);
  assert.equal(store.sessions.length, 1);
  assert.equal(store.challenges.length, 0);
});

test('a shared family email selects the account whose password matches', async () => {
  const sessions = [];
  const parent = { user_id: 'parent', password_hash: await hashPassword('parent-password') };
  const child = { user_id: 'child', password_hash: await hashPassword('child-password') };
  const store = {
    sessions,
    async getAccountsByLogin(_clubId, login) { return login === 'family@example.com' ? [parent, child] : []; },
    async getClubState() { return { payload: { users: [{ id: 'parent', role: 'TRAINEE' }, { id: 'child', role: 'TRAINEE' }] }, revision: 1 }; },
    async createSession(tokenHash, clubId, userId, expiresAt) { sessions.push({ tokenHash, clubId, userId, expiresAt }); }
  };
  const response = await requestLogin({ login: 'family@example.com', password: 'child-password' }, store);
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.user.id, 'child');
  assert.equal(sessions[0].userId, 'child');
});

test('invalid passwords do not send an SMS challenge', async () => {
  const store = await createStore();
  const response = await requestLogin({ login: 'trainee', password: 'wrong-password' }, store);
  assert.equal(response.status, 401);
  assert.equal(store.challenges.length, 0);
  assert.equal(store.sessions.length, 0);
});

test('phone login for an unknown number redirects the client to registration without sending SMS', async () => {
  const store = await createStore();
  const response = await worker.fetch(new Request('https://balywellness.test/api/auth/request-phone-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '0501234567', purpose: 'LOGIN' })
  }), {
    CLUB_ID: 'test-club',
    STATE_STORE: store,
    SMS_TEST_MODE: 'true',
    SMS_OTP_SIGNING_SECRET: signingSecret
  });
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(payload, { ok: false, registrationRequired: true });
  assert.equal(store.challenges.length, 0);
});
