import test from 'node:test';
import assert from 'node:assert/strict';
import { repeatedMonthlyPayments, repeatedPaymentMessage } from '../shared/monthly-payment-warning.js';
import { fitsSessionAge, isYouthSession, sessionAgeMax } from '../shared/youth-session.js';
import { mergePayloadForUser } from './auth.js';
import worker from './index.js';
import { clubDate } from '../shared/membership-calendar.js';
import { readFileSync } from 'node:fs';

const now = new Date('2026-10-05T09:00:00Z');
const receipt = (patch = {}) => ({ id: 'p', traineeId: 'u', status: 'PAID', date: '2026-10-02', membershipTypePurchased: 'GROUP_MONTHLY', ...patch });
const payload = payments => ({ users: [{ id: 'u', name: 'מני' }, { id: 'v', name: 'בן משפחה' }], payments });
test('paid group renewals warn across monthly/annual/youth variants within club calendar month', () => {
  const matches = repeatedMonthlyPayments(payload([receipt()]), { userId: 'u', membershipType: 'GROUP_ANNUAL' }, {}, now);
  assert.equal(matches.length, 1);
  assert.match(repeatedPaymentMessage(matches), /כבר שילמת החודש/);
  assert.equal(repeatedMonthlyPayments(payload([receipt({ membershipTypePurchased: 'OPEN_GYM' })]), { userId: 'u', membershipType: 'OPEN_GYM' }, {}, now).length, 1);
  assert.equal(repeatedMonthlyPayments(payload([receipt()]), { userId: 'u', membershipType: 'OPEN_GYM' }, {}, now).length, 1, 'paid group plan already includes Open Gym');
  assert.deepEqual(repeatedMonthlyPayments(payload([receipt({ membershipTypePurchased: 'OPEN_GYM' })]), { userId: 'u', membershipType: 'GROUP_MONTHLY' }, {}, now), []);
});
test('no warning for another month, user, pending/refunded/mock receipt, or training card', () => {
  for (const patch of [{ date: '2026-09-30' }, { traineeId: 'v' }, { status: 'PENDING' }, { refundedAt: '2026-10-03' }, { isMock: true }]) {
    assert.deepEqual(repeatedMonthlyPayments(payload([receipt(patch)]), { userId: 'u', membershipType: 'GROUP_MONTHLY' }, {}, now), []);
  }
  assert.deepEqual(repeatedMonthlyPayments(payload([receipt({ membershipTypePurchased: 'PERSONAL_TRAINING' })]), { userId: 'u', membershipType: 'PERSONAL_TRAINING' }, {}, now), []);
});
test('family warning follows included individual selections; credit source and excluded members are not warned', () => {
  const state = payload([receipt()]);
  const request = { userId: 'u', membershipType: 'FAMILY_MEMBERSHIP', familyMemberPlans: [{ memberId: 'u', membershipType: 'GROUP_MONTHLY' }, { memberId: 'v', membershipType: 'GROUP_MONTHLY' }] };
  assert.equal(repeatedMonthlyPayments(state, request, {}, now).length, 1);
  assert.deepEqual(repeatedMonthlyPayments(state, request, { sourcePaymentId: 'p' }, now), []);
  request.familyMemberPlans[0].participation = 'SKIP';
  assert.deepEqual(repeatedMonthlyPayments(state, request, {}, now), []);
  const paidFamily = receipt({ membershipTypePurchased: 'FAMILY_MEMBERSHIP', familyMemberPlans: [{ memberId: 'v', membershipType: 'OPEN_GYM' }] });
  assert.equal(repeatedMonthlyPayments(payload([paidFamily]), { userId: 'v', membershipType: 'OPEN_GYM' }, {}, now).length, 1);
});
test('receipt near midnight uses Jerusalem calendar month', () => {
  const stamp = receipt({ date: '2026-09-30', timestamp: '2026-09-30T22:15:00Z' });
  assert.equal(repeatedMonthlyPayments(payload([stamp]), { userId: 'u', membershipType: 'GROUP_MONTHLY' }, {}, now).length, 1);
});
test('youth eligibility is inclusive at 18, preserves lower bound, hides unknown/adult age', () => {
  const session = { title: 'אימון נוער', ageMin: 12, ageMax: 17 };
  assert.equal(sessionAgeMax(session), 18);
  for (const age of [12, 17, 18]) assert.equal(fitsSessionAge(session, { age }), true);
  for (const age of [11, 19, undefined, 0]) assert.equal(fitsSessionAge(session, { age }), false);
  assert.equal(isYouthSession({ allowedMemberships: ['YOUTH_ONCE_WEEKLY'] }), true);
  assert.equal(isYouthSession({ title: 'בוגרים', allowedMemberships: ['GROUP_MONTHLY', 'YOUTH_ONCE_WEEKLY'] }), false);
  assert.equal(sessionAgeMax({ title: 'בוגרים', ageMax: 60 }), 60);
});
test('server rejects adult youth joins and waitlisting, but permits age 18 and cancelling existing bookings', () => {
  const session = { id: 's', title: 'נוער', ageMin: 12, ageMax: 17, registeredUsers: [], waitlistUsers: [] };
  const state = { users: [{ id: 'u', role: 'TRAINEE', age: 19, membershipStatus: 'ACTIVE' }], sessions: [session], openGymSessions: [], messages: [], attendanceLogs: [] };
  const incoming = { ...state, sessions: [{ ...session, registeredUsers: ['u'], waitlistUsers: ['u'] }] };
  assert.deepEqual(mergePayloadForUser(state, incoming, 'u', 'TRAINEE').sessions[0].registeredUsers, []);
  assert.deepEqual(mergePayloadForUser(state, incoming, 'u', 'TRAINEE').sessions[0].waitlistUsers, []);
  state.users[0].age = 18;
  assert.deepEqual(mergePayloadForUser(state, incoming, 'u', 'TRAINEE').sessions[0].registeredUsers, ['u']);
  state.users[0].age = 19; state.sessions[0].registeredUsers = ['u'];
  assert.deepEqual(mergePayloadForUser(state, { ...state, sessions: [{ ...session, registeredUsers: [] }] }, 'u', 'TRAINEE').sessions[0].registeredUsers, []);
});
test('payment API stops before provider dispatch until additional payment is explicitly acknowledged', async () => {
  let dispatches = 0;
  const env = { CLUB_ID: 'test', RIVHIT_ENVIRONMENT: 'test', RIVHIT_GROUP_PRIVATE_TOKEN: 'fixture-only', PAYMENT_SIGNING_SECRET: 'fixture-signature', PUBLIC_APP_URL: 'https://club.test/',
    STATE_STORE: { getSession: async () => ({ user_id: 'u', club_id: 'test' }), getAccount: async () => ({ user_id: 'u' }),
      getClubState: async () => ({ payload: payload([receipt({ date: clubDate() })]), revision: 1 }) },
    RIVHIT_FETCH: async () => { dispatches++; return Response.json({ Status: 0, URL: 'https://testicredit.rivhit.co.il/payment/test', PrivateSaleToken: 'fixture', PublicSaleToken: 'fixture-public' }); } };
  const request = acknowledgement => worker.fetch(new Request('https://club.test/api/payments/rivhit/create', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: 'baly_session=test' },
    body: JSON.stringify({ userId: 'u', userName: 'מני', membershipType: 'GROUP_MONTHLY', mode: 'PRIMARY', repeatPaymentAcknowledged: acknowledgement }) }), env);
  const blocked = await request(false);
  assert.equal(blocked.status, 409); assert.equal((await blocked.json()).code, 'REPEAT_MONTHLY_PAYMENT'); assert.equal(dispatches, 0);
  const accepted = await request(true);
  assert.equal(accepted.status, 200, await accepted.text()); assert.equal(dispatches, 1);
});
test('youth options are filtered even before the show-all override', () => {
  const source = readFileSync(new URL('../src/components/TraineeDashboard.tsx', import.meta.url), 'utf8');
  assert.match(source, /\.filter\(session => !isYouthSession\(session\) \|\| fitsSessionAge\(session, activeUser\)\)/);
  const payment = readFileSync(new URL('../src/data/rivhitPayments.ts', import.meta.url), 'utf8');
  assert.match(payment, /window.confirm\(result.message\)/);
  assert.match(payment, /response = await create\(true\)/);
});
