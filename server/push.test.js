import test from 'node:test';
import assert from 'node:assert/strict';
import {isPushConfigured, israelDateTimeToTimestamp, validatePushSubscription} from './push.js';

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

test('calculates workout reminder times in the Israel time zone including daylight saving', () => {
  assert.equal(israelDateTimeToTimestamp('2026-08-23', '19:00'), Date.parse('2026-08-23T16:00:00Z'));
  assert.equal(israelDateTimeToTimestamp('2026-12-01', '19:00'), Date.parse('2026-12-01T17:00:00Z'));
  assert.equal(Number.isNaN(israelDateTimeToTimestamp('invalid', '19:00')), true);
});
