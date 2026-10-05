import assert from 'node:assert/strict';
import test from 'node:test';
import { recurringSummary, recurringCapabilities, recurringConsent, recurringCheckoutPlans } from '../shared/recurring-billing.js';
import { recurringReminderEvents, sendRecurringReminders } from './recurring-reminders.js';
import { mergePayloadForUser, payloadForUser } from './auth.js';
import worker from './index.js';

const plan = { id: 'GROUP_MONTHLY', active: true, label: 'קבוצתי', price: 500, paymentMode: 'RECURRING', recurringTermMonths: 12, renewalMode: 'AUTO' };
test('legacy plans remain one-off; calendar recurring terms and consent are explicit', () => {
  assert.equal(recurringSummary({ ...plan, paymentMode: undefined }), null);
  const summary = recurringSummary(plan, new Date('2026-10-15T12:00:00Z'));
  assert.equal(summary.nextChargeAt, '2026-11-01');
  assert.equal(summary.endsAt, '2027-10-01');
  assert.equal(summary.firstChargeAmount, 500);
  assert.equal(summary.monthlyAmount, 500);
  assert.equal(summary.renewalMode, 'AUTO');
  assert.throws(() => recurringConsent(summary, 'user', { accepted: false }), /CONSENT_REQUIRED/);
  assert.throws(() => recurringConsent(summary, 'user', { accepted: true, termsVersion: 'old' }), /CONSENT_REQUIRED/);
  assert.equal(recurringConsent(summary, 'user', { accepted: true, termsVersion: summary.termsVersion }).summary.monthlyAmount, 500);
  assert.throws(() => recurringSummary({ ...plan, recurringTermMonths: 0 }), /INVALID_RECURRING_PLAN/);
  assert.equal(recurringCapabilities().creationEnabled, false);
});
test('family selection identifies included recurring plans only', () => {
  assert.equal(recurringCheckoutPlans({ membershipType: 'FAMILY_MEMBERSHIP', familyMemberPlans: [{ membershipType: plan.id, participation: 'INCLUDED' }] }, [plan]).length, 1);
  assert.equal(recurringCheckoutPlans({ membershipType: 'FAMILY_MEMBERSHIP', familyMemberPlans: [{ membershipType: plan.id, participation: 'EXCLUDED' }] }, [plan]).length, 0);
});
const reminderPayload = () => ({ users: [{ id: 'manager', role: 'MANAGER' }, { id: 'user', role: 'TRAINEE', phone: '0500000000' }], messages: [], recurringSubscriptions: [{ id: 'sub', userId: 'user', planName: 'קבוצתי', monthlyAmount: 500, termMonths: 12, endsAt: '2026-11-04', renewalMode: 'AUTO', status: 'ACTIVE', providerVerifiedAt: '2026-10-01', providerRecurringSaleId: 'recurring-provider-id', consent: { acceptedAt: '2026-10-01' } }] });
const now = new Date('2026-10-05T06:00:00Z'); // 09:00 Israel, 30 days before expiry
test('reminders require a verified provider subscription and real consent, not just a monthly user', () => {
  assert.equal(recurringReminderEvents(reminderPayload(), now).length, 1);
  const payload = reminderPayload();
  payload.recurringSubscriptions[0].providerVerifiedAt = undefined;
  assert.equal(recurringReminderEvents(payload, now).length, 0);
  assert.equal(recurringReminderEvents(reminderPayload(), new Date('2026-10-05T05:00:00Z')).length, 0);
  const confirmation = reminderPayload(); confirmation.recurringSubscriptions[0].renewalMode = 'CONFIRM';
  assert.match(recurringReminderEvents(confirmation, now)[0].text, /נדרש אישור/);
  assert.equal(recurringReminderEvents(reminderPayload(), new Date('2026-10-28T07:00:00Z'))[0].id.endsWith(':7'), true);
  assert.equal(recurringReminderEvents(reminderPayload(), new Date('2026-11-04T07:00:00Z'))[0].id.endsWith(':0'), true);
});
test('SMS and chat survive scheduler restarts without repeat attempts; timeout requires review', async () => {
  let state = { payload: reminderPayload(), revision: 1 };
  const claims = new Set(); let sms = 0;
  const store = {
    async getAllClubStates() { return [{ club_id: 'club', payload: state.payload }]; },
    async getClubState() { return state; },
    async putClubState(_club, payload, revision) { assert.equal(revision, state.revision); state = { payload, revision: revision + 1 }; return { conflict: false }; },
    async claimPushDelivery(_club, key) { if (claims.has(key)) return false; claims.add(key); return true; }
  };
  const send = async () => { sms++; throw new Error('timeout'); };
  await sendRecurringReminders(store, {}, null, now, send);
  assert.equal(sms, 0);
  for (let i = 0; i < 2; i++) await sendRecurringReminders(store, { RECURRING_REMINDERS_ENABLED: 'true' }, null, now, send);
  assert.equal(sms, 1);
  assert.equal(state.payload.messages.length, 1);
  assert.equal(state.payload.recurringNotices[0].smsStatus, 'REVIEW_REQUIRED');
});
test('provider subscriptions are private and cannot be forged or erased through state saves', () => {
  const payload = reminderPayload();
  const merged = mergePayloadForUser(payload, { ...payload, recurringSubscriptions: [], recurringNotices: [{ id: 'fake' }] }, 'manager', 'MANAGER');
  assert.equal(merged.recurringSubscriptions.length, 1);
  assert.equal(merged.recurringNotices.length, 0);
  assert.equal(payloadForUser(payload, 'other', 'TRAINEE').recurringSubscriptions.length, 0);
  assert.equal(payloadForUser(payload, 'user', 'TRAINEE').recurringSubscriptions.length, 1);
  assert.equal(payloadForUser(payload, 'coach', 'COACH').recurringSubscriptions.length, 0);
});
test('push failure does not block SMS; provider request uses a UUID and records acceptance only', async () => {
  let state = { payload: reminderPayload(), revision: 1 };
  const store = {
    async getAllClubStates() { return [{ club_id: 'club', payload: state.payload }]; },
    async getClubState() { return state; },
    async putClubState(_club, payload) { state = { payload, revision: state.revision + 1 }; return { conflict: false }; },
    async claimPushDelivery() { return true; }
  };
  let reference;
  await sendRecurringReminders(store, { RECURRING_REMINDERS_ENABLED: 'true' }, async () => { throw new Error('push unavailable'); }, now, async request => { reference = request.reference; return { ok: true }; });
  assert.match(reference, /^[a-f0-9-]{36}$/);
  assert.equal(state.payload.recurringNotices[0].smsStatus, 'PROVIDER_ACCEPTED');
  assert.equal(state.payload.recurringNotices[0].smsReference, reference);
});
test('recurring checkout stays blocked even with activation environment flags and client override', async () => {
  let calls = 0;
  const store = {
    async getSession() { return { user_id: 'user', club_id: 'club' }; },
    async getClubState() { return { payload: { settings: { membershipPlans: [plan] }, users: [{ id: 'user' }] } }; }
  };
  const response = await worker.fetch(new Request('https://club.test/api/payments/rivhit/create', { method: 'POST', headers: { Cookie: 'baly_session=test', 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: 'user', membershipType: plan.id, mode: 'PRIMARY', paymentMode: 'ONE_TIME' }) }), {
    STATE_STORE: store, CLUB_ID: 'club', RIVHIT_ENVIRONMENT: 'test', RIVHIT_GROUP_PRIVATE_TOKEN: 'test-group-token', PAYMENT_SIGNING_SECRET: 'test-only-signing-secret', PUBLIC_APP_URL: 'https://club.test/', RIVHIT_ENABLE_RECURRING: 'true', RIVHIT_RECURRING_APPROVED: 'true', RIVHIT_FETCH: async () => { calls++; return Response.json({}); }
  });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, 'RECURRING_NOT_ENABLED');
  assert.equal(calls, 0);
});
test('server preview uses the catalog, while status access is manager only', async () => {
  const store = {
    async getSession() { return { user_id: 'user', club_id: 'club' }; },
    async getAccount() { return { user_id: 'user', role: 'TRAINEE' }; },
    async getClubState() { return { payload: { settings: { membershipPlans: [plan] }, users: [{ id: 'user', role: 'TRAINEE' }] } }; }
  };
  const env = { STATE_STORE: store, CLUB_ID: 'club' };
  const preview = await worker.fetch(new Request('https://club.test/api/payments/rivhit/recurring/preview', { method: 'POST', headers: { Cookie: 'baly_session=test', 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: 'user', membershipType: plan.id, price: 1 }) }), env);
  assert.equal(preview.status, 200);
  const result = await preview.json();
  assert.equal(result.summary.monthlyAmount, 500);
  assert.equal(result.creationEnabled, false);
  const status = await worker.fetch(new Request('https://club.test/api/payments/rivhit/recurring/status', { headers: { Cookie: 'baly_session=test' } }), env);
  assert.equal(status.status, 403);
});
