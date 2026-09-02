import assert from 'node:assert/strict';
import test from 'node:test';
import worker from './index.js';
import { hashPassword } from './auth.js';

test('a login repairs a trainee account missing from club state and creates the staff chat notice', async () => {
  let state = {
    payload: {
      users: [{ id: 'manager-1', name: 'רובי באלי', role: 'MANAGER' }],
      payments: [{
        id: 'payment-1', traineeId: 'trainee-missing', traineeName: 'מני בללי', amount: 350,
        status: 'PAID', membershipTypePurchased: 'NUTRITION_COACHING', date: '2026-09-01'
      }],
      messages: []
    },
    revision: 7
  };
  const account = {
    user_id: 'trainee-missing', username_normalized: 'meni', email_normalized: 'meni@example.com',
    phone_normalized: '0547332390', password_hash: await hashPassword('correct-password'), role: 'TRAINEE', profile: null
  };
  const challenges = [];
  const store = {
    async getAccountByLogin() { return account; },
    async getClubState() { return state; },
    async listAccounts() { return [account]; },
    async updateAccountIdentity(_clubId, user) { account.profile = user; },
    async putClubState(_clubId, payload, expectedRevision) {
      assert.equal(expectedRevision, state.revision);
      state = { payload, revision: state.revision + 1 };
      return { conflict: false, revision: state.revision };
    },
    async getOtpRequestStats() { return { requestsLastHour: 0, lastRequestedAt: null }; },
    async createOtpChallenge(challenge) { challenges.push(challenge); }
  };

  const response = await worker.fetch(new Request('https://balywellness.test/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: 'meni', password: 'correct-password' })
  }), {
    CLUB_ID: 'test-club', STATE_STORE: store, SMS_TEST_MODE: 'true',
    SMS_OTP_SIGNING_SECRET: 'user-recovery-api-signing-secret-value'
  });

  assert.equal(response.status, 202);
  assert.equal(state.payload.users.some(user => user.id === account.user_id && user.name === 'מני בללי'), true);
  assert.equal(state.payload.messages.some(message => message.receiverId === 'manager-1' && message.senderId === account.user_id), true);
  assert.equal(challenges.length, 1);
});
