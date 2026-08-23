import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createPhoneVerificationToken,
  normalizeIsraeliMobile,
  requestPhoneCode,
  sendPulseemSms,
  verifyPhoneCode,
  verifyPhoneVerificationToken
} from './sms-auth.js';

const secret = 'test-signing-secret-that-is-longer-than-32-characters';

const createStore = () => {
  const challenges = [];
  return {
    challenges,
    async getOtpRequestStats() { return { requestsLastHour: challenges.length, lastRequestedAt: null }; },
    async createOtpChallenge(challenge) { challenges.push({ ...challenge, attempts: 0, max_attempts: challenge.maxAttempts, expires_at: challenge.expiresAt, consumed_at: null }); },
    async getLatestOtpChallenge(_clubId, phone, purpose) { return [...challenges].reverse().find(item => item.phone === phone && item.purpose === purpose) || null; },
    async consumeOtpChallenge(id, expectedHash) {
      const challenge = challenges.find(item => item.id === id);
      challenge.attempts += 1;
      if (challenge.codeHash !== expectedHash) return false;
      challenge.consumed_at = new Date();
      return true;
    },
    async invalidateOtpChallenge(id) {
      const challenge = challenges.find(item => item.id === id);
      challenge.consumed_at = new Date();
    }
  };
};

test('normalizes local and international Israeli mobile numbers', () => {
  assert.equal(normalizeIsraeliMobile('054-6995885'), '0546995885');
  assert.equal(normalizeIsraeliMobile('+972-54-6995885'), '0546995885');
  assert.equal(normalizeIsraeliMobile('03-1234567'), '');
});

test('Pulseem request uses the APIKey header and documented SendSms shape', async () => {
  let captured;
  await sendPulseemSms({
    env: { PULSEEM_API_KEY: 'not-a-real-key', PULSEEM_FROM_NUMBER: 'BALY' },
    phone: '0546995885',
    text: 'test message',
    reference: 'reference-1',
    fetchImpl: async (url, init) => {
      captured = { url, init };
      return new Response('', { status: 200 });
    }
  });
  assert.equal(captured.url, 'https://api.pulseem.com/api/v1/SmsApi/SendSms');
  assert.equal(captured.init.headers.APIKey, 'not-a-real-key');
  const body = JSON.parse(captured.init.body);
  assert.deepEqual(body.smsSendData.toNumberList, ['0546995885']);
  assert.deepEqual(body.smsSendData.referenceList, ['reference-1']);
  assert.deepEqual(body.smsSendData.textList, ['test message']);
  assert.equal(body.isAsync, false);
});

test('test-mode OTP is hashed, expires, and can only be consumed once', async () => {
  const store = createStore();
  const env = { SMS_TEST_MODE: 'true', SMS_OTP_SIGNING_SECRET: secret };
  const result = await requestPhoneCode({ store, env, clubId: 'club', phone: '054-6995885', purpose: 'LOGIN' });
  assert.equal(result.testMode, true);
  assert.equal(store.challenges[0].codeHash.includes('1111'), false);
  assert.equal(await verifyPhoneCode({ store, env, clubId: 'club', phone: '0546995885', purpose: 'LOGIN', code: '0000' }), false);
  assert.equal(await verifyPhoneCode({ store, env, clubId: 'club', phone: '0546995885', purpose: 'LOGIN', code: '1111' }), true);
  assert.equal(await verifyPhoneCode({ store, env, clubId: 'club', phone: '0546995885', purpose: 'LOGIN', code: '1111' }), false);
});

test('registration verification token is bound to club, phone, and expiry', async () => {
  const env = { SMS_OTP_SIGNING_SECRET: secret, SMS_PHONE_VERIFICATION_TTL_SECONDS: '7200' };
  const token = await createPhoneVerificationToken({ env, clubId: 'club', phone: '0546995885' });
  assert.equal(await verifyPhoneVerificationToken({ env, clubId: 'club', phone: '+972546995885', token }), true);
  assert.equal(await verifyPhoneVerificationToken({ env, clubId: 'other', phone: '0546995885', token }), false);
  assert.equal(await verifyPhoneVerificationToken({ env, clubId: 'club', phone: '0500000000', token }), false);
});
