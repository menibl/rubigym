import test from 'node:test';
import assert from 'node:assert/strict';
import { paymentReminderWindow, paymentReminderEligible } from '../shared/payment-reminder-policy.js';
import { paymentReminderDate, paymentReminderRecipients, sendPaymentReminders } from './payment-reminders.js';
import { mergePayloadForUser, payloadForUser } from './auth.js';

const member = (patch = {}) => ({ id: 'member', role: 'TRAINEE', name: 'מתאמן לדוגמה', phone: '0500000001', membershipType: 'GROUP_MONTHLY', membershipStatus: 'ACTIVE', membershipExpiry: '2026-11-01', membershipExpiryExclusive: true, ...patch });
const data = (users = [member()]) => ({ users: [{ id: 'manager', role: 'MANAGER', name: 'מנהל' }, ...users], messages: [] });
const now = date => Date.parse(`${date}T10:00:00Z`);
const env = { PULSEEM_API_KEY: 'test-placeholder', PULSEEM_FROM_NUMBER: 'test' };
function memoryStore(payload = data()) {
  let state = { payload: structuredClone(payload), revision: 1 };
  const claims = new Set();
  return { state: () => state, claims,
    getAllClubStates: async () => [{ club_id: 'club' }], getClubState: async () => structuredClone(state),
    putClubState: async (_id, payload, revision) => {
      if (revision !== state.revision) return { conflict: true };
      state = { payload: structuredClone(payload), revision: revision + 1 }; return { conflict: false };
    }, claimPushDelivery: async (_club, key) => { if (claims.has(key)) return false; claims.add(key); return true; }
  };
}

test('fourteen days from first expired day, inclusive/exclusive and leap dates', () => {
  assert.equal(paymentReminderEligible(member(), '2026-10-31'), false);
  assert.equal(paymentReminderEligible(member(), '2026-11-01'), true);
  assert.equal(paymentReminderEligible(member(), '2026-11-14'), true);
  assert.equal(paymentReminderEligible(member(), '2026-11-15'), false);
  assert.equal(paymentReminderWindow(member({ membershipExpiryExclusive: false }), '2026-11-01').active, false);
  assert.equal(paymentReminderWindow(member({ membershipExpiry: '2024-02-29', membershipExpiryExclusive: false }), '2024-03-01').start, '2024-03-01');
});

test('Israel daytime only including DST, no night or invalid expiry backfill', () => {
  assert.equal(paymentReminderDate(Date.parse('2026-10-24T07:00:00Z')), '2026-10-24');
  assert.equal(paymentReminderDate(Date.parse('2026-11-01T08:00:00Z')), '2026-11-01');
  assert.equal(paymentReminderDate(Date.parse('2026-11-01T07:59:59Z')), null);
  assert.equal(paymentReminderDate(Date.parse('2026-11-01T18:00:00Z')), null);
  for (const membershipExpiry of [undefined, '', '2026-02-30', 'invalid']) assert.equal(paymentReminderEligible(member({ membershipExpiry }), '2026-11-01'), false);
});

test('renewal, freeze, not-paying, cancellation, incomplete and staff suppress reminders', () => {
  for (const patch of [{ membershipExpiry: '2026-12-01' }, { isMembershipFrozen: true }, { paymentReminderExempt: true }, { cancellationEffectiveDate: '2026-11-01' }, { registrationIncomplete: true }, { role: 'COACH' }]) {
    assert.equal(paymentReminderEligible(member(patch), '2026-11-04'), false);
  }
  assert.equal(paymentReminderEligible(member({ isMembershipFrozen: true, membershipFrozenUntil: '2026-11-03' }), '2026-11-04'), true);
});

test('manager extension is inclusive, restarts old reminders, and never carries into renewed expiry', () => {
  const extended = member({ paymentReminderExpiry: '2026-11-01', paymentReminderUntil: '2026-12-10' });
  assert.equal(paymentReminderEligible(extended, '2026-12-10'), true);
  assert.equal(paymentReminderEligible(extended, '2026-12-11'), false);
  assert.equal(paymentReminderEligible({ ...extended, membershipExpiry: '2026-12-01' }, '2026-12-15'), false);
  assert.equal(paymentReminderEligible({ ...extended, paymentReminderExempt: true }, '2026-12-10'), false);
});

test('one app message daily and SMS on days 0/3/6/9/12, then stops; repeated scheduler calls are safe', async () => {
  const store = memoryStore(); let sms = 0; let pushes = 0;
  for (let day = 1; day <= 16; day++) {
    for (let tick = 0; tick < 2; tick++) await sendPaymentReminders(store, env, async () => pushes++, now(`2026-11-${String(day).padStart(2, '0')}`), async () => { sms++; });
  }
  assert.equal(store.state().payload.messages.length, 14);
  assert.equal(pushes, 14); assert.equal(sms, 5);
  assert.equal(store.state().payload.messages[0].actionUrl, '?workspace=my_membership');
  assert.equal(store.state().payload.membershipReminderDeliveries.length, 5);
});

test('parallel schedulers and process restarts do not duplicate SMS or chat messages', async () => {
  const store = memoryStore(); let sms = 0; let pushes = 0;
  await Promise.all([1, 2, 3].map(() => sendPaymentReminders(store, env, async () => pushes++, now('2026-11-01'), async () => { sms++; })));
  await sendPaymentReminders(store, env, async () => pushes++, now('2026-11-01'), async () => { sms++; });
  assert.equal(sms, 1); assert.equal(pushes, 1); assert.equal(store.state().payload.messages.length, 1);
});

test('ambiguous SMS failure is recorded and never retried within the same slot', async () => {
  const store = memoryStore(); let sms = 0;
  const send = async () => { sms++; throw new Error('timeout'); };
  await sendPaymentReminders(store, env, async () => {}, now('2026-11-01'), send);
  await sendPaymentReminders(store, env, async () => {}, now('2026-11-01'), send);
  assert.equal(sms, 1); assert.equal(store.state().payload.membershipReminderDeliveries[0].status, 'FAILED_OR_UNKNOWN');
});

test('SMS works without push; missing SMS configuration still saves the app message', async () => {
  const store = memoryStore(); let sms = 0;
  await sendPaymentReminders(store, {}, async () => {}, now('2026-11-01'), async () => sms++);
  assert.equal(sms, 0); assert.equal(store.state().payload.messages.length, 1);
  await sendPaymentReminders(store, env, async () => {}, now('2026-11-01'), async () => sms++);
  assert.equal(sms, 1);
});

test('operator kill switch stops both channels without affecting existing state', async () => {
  const store = memoryStore(); let sms = 0;
  await sendPaymentReminders(store, { ...env, PAYMENT_REMINDERS_ENABLED: 'false' }, async () => {}, now('2026-11-01'), async () => sms++);
  assert.equal(store.state().payload.messages.length, 0); assert.equal(sms, 0);
});

test('different family expiry days cannot increase SMS frequency above every three days', async () => {
  const payer = member({ id: 'payer', familyId: 'f', membershipExpiry: '2026-12-01' });
  const store = memoryStore(data([payer, member({ id: 'child1', familyPayerId: 'payer', familyId: 'f' }), member({ id: 'child2', familyPayerId: 'payer', familyId: 'f', membershipExpiry: '2026-11-02' })]));
  const days = [];
  for (let day = 1; day <= 5; day++) await sendPaymentReminders(store, env, async () => {}, now(`2026-11-0${day}`), async () => days.push(day));
  assert.deepEqual(days, [1, 4]);
});

test('rechecks eligibility immediately before SMS, after renewal races with dispatch', async () => {
  const store = memoryStore(); let sms = 0;
  await sendPaymentReminders(store, env, async () => {
    store.state().payload.users[1].membershipExpiry = '2026-12-01';
  }, now('2026-11-01'), async () => sms++);
  assert.equal(sms, 0);
});

test('family recipients are paying adults only, exclude paused members and respect payer exemption', async () => {
  const payer = member({ id: 'payer', familyId: 'f', membershipExpiry: '2026-12-01', familyMemberPlans: [{ memberId: 'child2', participation: 'NOT_STARTED' }] });
  const child = member({ id: 'child', familyId: 'f', familyPayerId: 'payer' });
  const payload = data([payer, child, { ...child, id: 'child2' }]);
  const entries = paymentReminderRecipients(payload, '2026-11-01');
  assert.equal(entries.length, 1); assert.equal(entries[0].recipient.id, 'payer'); assert.deepEqual(entries[0].members.map(u => u.id), ['child']);
  payer.paymentReminderExempt = true;
  assert.equal(paymentReminderRecipients(payload, '2026-11-01').length, 0);
});

test('same phone number is not sent multiple SMS for different family records', async () => {
  const store = memoryStore(data([member(), member({ id: 'other' })])); let sms = 0;
  await sendPaymentReminders(store, env, async () => {}, now('2026-11-01'), async () => sms++);
  assert.equal(sms, 1);
});

test('no retroactive sends for long expired users, but explicit extension allows current-day only', async () => {
  const store = memoryStore(); let sms = 0;
  await sendPaymentReminders(store, env, async () => {}, now('2026-11-22'), async () => sms++);
  assert.equal(store.state().payload.messages.length, 0);
  Object.assign(store.state().payload.users[1], { paymentReminderExpiry: '2026-11-01', paymentReminderUntil: '2026-12-01' });
  await sendPaymentReminders(store, env, async () => {}, now('2026-11-22'), async () => sms++);
  assert.equal(store.state().payload.messages.length, 1); assert.equal(sms, 1);
});

test('only managers edit reminder settings; stale client cannot erase SMS audit or expose it to trainees', () => {
  const current = { ...data(), membershipReminderDeliveries: [{ id: 'audit', userId: 'other' }] };
  const incoming = structuredClone(current);
  incoming.membershipReminderDeliveries = [];
  Object.assign(incoming.users[1], { paymentReminderExempt: true, paymentReminderUntil: '2026-12-31', paymentReminderExpiry: '2026-11-01' });
  assert.equal(mergePayloadForUser(current, incoming, 'member', 'TRAINEE').users[1].paymentReminderExempt, undefined);
  assert.equal(mergePayloadForUser(current, incoming, 'coach', 'COACH').users[1].paymentReminderExempt, undefined);
  const manager = mergePayloadForUser(current, incoming, 'manager', 'MANAGER');
  assert.equal(manager.users[1].paymentReminderExempt, true);
  assert.deepEqual(manager.membershipReminderDeliveries, current.membershipReminderDeliveries);
  assert.deepEqual(payloadForUser(current, 'member', 'TRAINEE').membershipReminderDeliveries, []);
});

test('legacy manager clients preserve reminder settings; explicit clear resets the extension', () => {
  const current = data([member({ paymentReminderExempt: true, paymentReminderUntil: '2026-12-01', paymentReminderExpiry: '2026-11-01' })]);
  const incoming = data();
  const merged = mergePayloadForUser(current, incoming, 'manager', 'MANAGER');
  assert.equal(merged.users[1].paymentReminderExempt, true);
  assert.equal(merged.users[1].paymentReminderUntil, '2026-12-01');
  Object.assign(incoming.users[1], { paymentReminderExempt: false, paymentReminderUntil: '', paymentReminderExpiry: '' });
  const reset = mergePayloadForUser(current, incoming, 'manager', 'MANAGER');
  assert.equal(reset.users[1].paymentReminderExempt, false); assert.equal(reset.users[1].paymentReminderUntil, undefined);
});
