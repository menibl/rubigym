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

test('password login requires a valid SMS code before creating a session', async () => {
  const store = await createStore();

  const firstResponse = await requestLogin({ login: 'trainee', password: 'correct-password' }, store);
  const firstPayload = await firstResponse.json();
  assert.equal(firstResponse.status, 202);
  assert.equal(firstPayload.requiresSmsVerification, true);
  assert.equal(firstPayload.maskedPhone, '***-***-5885');
  assert.equal(store.sessions.length, 0);
  assert.equal(store.challenges.length, 1);

  const secondResponse = await requestLogin({ login: 'trainee', password: 'correct-password', otp: '1111' }, store);
  assert.equal(secondResponse.status, 200);
  assert.match(secondResponse.headers.get('Set-Cookie') || '', /^baly_session=/);
  assert.equal(store.sessions.length, 1);
});

test('invalid passwords do not send an SMS challenge', async () => {
  const store = await createStore();
  const response = await requestLogin({ login: 'trainee', password: 'wrong-password' }, store);
  assert.equal(response.status, 401);
  assert.equal(store.challenges.length, 0);
  assert.equal(store.sessions.length, 0);
});
