import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuthenticatedSession} from './auth.js';
import worker from './index.js';
import {
  dispatchStateChangePushes,
  isInvalidPushSubscriptionError,
  isPushConfigured,
  isRetryablePushError,
  israelDateTimeToTimestamp,
  messagePushPayload,
  pushErrorStatus,
  validatePushSubscription
} from './push.js';

test('requires the complete VAPID configuration', () => {
  assert.equal(isPushConfigured({}), false);
  assert.equal(isPushConfigured({VAPID_PUBLIC_KEY: 'public', VAPID_PRIVATE_KEY: 'private'}), false);
  assert.equal(isPushConfigured({
    VAPID_PUBLIC_KEY: 'public',
    VAPID_PRIVATE_KEY: 'private',
    VAPID_SUBJECT: 'mailto:notifications@example.com',
  }), true);
});

test('accepts only complete HTTPS push subscriptions', () => {
  assert.deepEqual(validatePushSubscription({
    endpoint: 'https://push.example.com/subscription/123',
    keys: {p256dh: 'browser-public-key', auth: 'browser-auth-secret'},
  }), {
    endpoint: 'https://push.example.com/subscription/123',
    keys: {p256dh: 'browser-public-key', auth: 'browser-auth-secret'},
  });
  assert.equal(validatePushSubscription({endpoint: 'http://push.example.com', keys: {p256dh: 'key', auth: 'auth'}}), null);
  assert.equal(validatePushSubscription({endpoint: 'https://127.0.0.1/push', keys: {p256dh: 'key', auth: 'auth'}}), null);
  assert.equal(validatePushSubscription({endpoint: 'https://push.example.com', keys: {p256dh: '', auth: ''}}), null);
});

test('retries temporary push provider failures and removes permanently invalid subscriptions', () => {
  assert.equal(pushErrorStatus({statusCode: 429}), 429);
  assert.equal(isRetryablePushError({statusCode: 429}), true);
  assert.equal(isRetryablePushError({statusCode: 503}), true);
  assert.equal(isRetryablePushError(new Error('network timeout')), true);
  assert.equal(isRetryablePushError({statusCode: 410}), false);
  assert.equal(isInvalidPushSubscriptionError({statusCode: 400}), true);
  assert.equal(isInvalidPushSubscriptionError({statusCode: 403}), true);
  assert.equal(isInvalidPushSubscriptionError({statusCode: 404}), true);
  assert.equal(isInvalidPushSubscriptionError({statusCode: 410}), true);
});

test('calculates workout reminder times in the Israel time zone including daylight saving', () => {
  assert.equal(israelDateTimeToTimestamp('2026-08-23', '19:00'), Date.parse('2026-08-23T16:00:00Z'));
  assert.equal(israelDateTimeToTimestamp('2026-12-01', '19:00'), Date.parse('2026-12-01T17:00:00Z'));
  assert.equal(Number.isNaN(israelDateTimeToTimestamp('invalid', '19:00')), true);
});

test('message push opens the matching chat conversation', () => {
  const payload = messagePushPayload({id: 'message-1', senderId: 'coach 1', senderName: 'רובי', content: 'נתראה באימון'});
  assert.equal(payload.url, '?workspace=chat&contact=coach%201');
  assert.equal(payload.tag, 'message-message-1');
});

test('routes registration and purchase notifications to enabled club staff', async () => {
  const requestedUsers = [];
  const store = {
    async getPushSubscriptions(_clubId, userIds) {
      requestedUsers.push(userIds);
      return [];
    }
  };
  const manager = {
    id: 'manager-robi', role: 'MANAGER', name: 'רובי באלי',
    pushNotificationsEnabled: true, managerPushNotificationsEnabled: true
  };
  const trainee = {
    id: 'trainee-meni', role: 'TRAINEE', name: 'מני בללי', membershipStartedAt: '2026-08-26'
  };
  await dispatchStateChangePushes(store, {
    VAPID_PUBLIC_KEY: 'public', VAPID_PRIVATE_KEY: 'private', VAPID_SUBJECT: 'mailto:test@example.com'
  }, 'baly-wellness', {
    users: [manager], payments: []
  }, {
    users: [manager, trainee],
    payments: [{
      id: 'payment-nutrition', traineeId: trainee.id, traineeName: trainee.name,
      membershipTypePurchased: 'NUTRITION_COACHING', amount: 350, status: 'PAID'
    }]
  });

  assert.deepEqual(requestedUsers, [['manager-robi'], ['manager-robi']]);
});

test('push test targets only the subscription of the device requesting the test', async () => {
  const sessions = new Map();
  const store = {
    async createSession(tokenHash, clubId, userId, expiresAt) {
      sessions.set(tokenHash, {club_id: clubId, user_id: userId, expires_at: expiresAt});
    },
    async getSession(tokenHash) { return sessions.get(tokenHash); },
    async getAccount() { return {user_id: 'manager-robi', role: 'MANAGER'}; },
    async getPushSubscriptions() {
      return [{
        user_id: 'manager-robi', endpoint: 'https://push.example.com/another-device',
        p256dh: 'another-public-key', auth: 'another-auth-secret'
      }];
    }
  };
  const auth = await createAuthenticatedSession(store, 'baly-wellness', 'manager-robi');
  const response = await worker.fetch(new Request('https://balywellness.test/api/push/test', {
    method: 'POST',
    headers: {'Content-Type': 'application/json', Cookie: auth.cookie},
    body: JSON.stringify({
      endpoint: 'https://push.example.com/robi-phone',
      keys: {p256dh: 'robi-public-key', auth: 'robi-auth-secret'}
    })
  }), {
    STATE_STORE: store,
    VAPID_PUBLIC_KEY: 'public', VAPID_PRIVATE_KEY: 'private', VAPID_SUBJECT: 'mailto:test@example.com'
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {ok: true, sent: 0, failed: 0, removed: 0});
});
