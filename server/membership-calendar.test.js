import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarTerm, clubDate, membershipExpired, repairCalendarMemberships } from '../shared/membership-calendar.js';
import worker from './index.js';

test('calendar access expires on next first, including last-day payments and annual group', () => {
  for (const type of ['GROUP_MONTHLY', 'GROUP_ANNUAL', 'CORE_GROUPS', 'YOUTH_ONCE_WEEKLY', 'YOUTH_TWICE_WEEKLY', 'OPEN_GYM']) {
    const term = calendarTerm(type, new Date('2026-10-31T12:00:00Z'));
    assert.equal(term.membershipExpiry, '2026-11-01');
    assert.equal(term.monthlyBillingDay, 1);
    assert.equal(membershipExpired(term, '2026-10-31'), false);
    assert.equal(membershipExpired(term, '2026-11-01'), true);
  }
  assert.equal(calendarTerm('OPEN_GYM', new Date('2026-12-31T12:00:00Z')).membershipExpiry, '2027-01-01');
});
test('Israel timezone and legacy inclusive dates', () => {
  assert.equal(clubDate(new Date('2026-09-30T22:30:00Z')), '2026-10-01');
  assert.equal(calendarTerm('OPEN_GYM', new Date('2026-09-30T22:30:00Z')).membershipExpiry, '2026-11-01');
  assert.equal(membershipExpired({ membershipExpiry: '2026-11-01' }, '2026-11-01'), false);
});
test('personal, duo, packs and long prepaid terms are not replaced', () => {
  for (const type of ['PERSONAL_TRAINING', 'DUO_TRAINING', 'OPEN_PUNCH_CARD', 'WORKOUT_PLAN', 'NUTRITION_PLAN', 'DEDICATED_GROUP_HALF_YEAR']) assert.deepEqual(calendarTerm(type), {});
});
test('existing current-month receipts repair once and preserve manual edits, old receipts and addons', () => {
  const users = ['paid', 'manual', 'old', 'addon', 'unpaid'].map(id => ({ id, role: 'TRAINEE', membershipType: 'GROUP_MONTHLY', membershipStatus: 'ACTIVE', membershipExpiry: '2026-11-20', membershipExpiryManualOverride: id === 'manual' }));
  const payments = ['paid', 'manual', 'old', 'addon'].map(id => ({ traineeId: id, status: 'PAID', membershipTypePurchased: 'GROUP_MONTHLY', date: id === 'old' ? '2026-09-20' : '2026-10-01', purchaseMode: id === 'addon' ? 'ADDON' : 'PRIMARY' }));
  const now = new Date('2026-10-04T12:00:00Z');
  const result = repairCalendarMemberships({ users, payments }, now);
  assert.equal(result.changed, true);
  assert.equal(result.payload.users[0].membershipExpiry, '2026-11-01');
  assert.equal(result.payload.users[0].membershipExpiryBeforeCalendar, '2026-11-20');
  for (const user of result.payload.users.slice(1)) assert.equal(user.membershipExpiry, '2026-11-20');
  assert.equal(repairCalendarMemberships(result.payload, now).changed, false);
});
test('family repair includes paid members only, not excluded or unrelated members', () => {
  const users = ['included', 'excluded'].map(id => ({ id, role: 'TRAINEE', membershipType: 'OPEN_GYM', membershipStatus: 'ACTIVE', membershipExpiry: '2026-11-20' }));
  const payments = [{ traineeId: 'payer', membershipTypePurchased: 'FAMILY_MEMBERSHIP', status: 'PAID', date: '2026-10-01', familyMemberPlans: users.map(u => ({ memberId: u.id, membershipType: 'OPEN_GYM', participation: u.id === 'included' ? 'INCLUDED' : 'EXCLUDED' })) }];
  const result = repairCalendarMemberships({ users, payments }, new Date('2026-10-04T12:00:00Z'));
  assert.equal(result.payload.users[0].membershipExpiry, '2026-11-01');
  assert.equal(result.payload.users[1].membershipExpiry, '2026-11-20');
});

test('authenticated state load persists calendar repair once through revision checking', async () => {
  const now = new Date();
  let writes = 0;
  let state = { revision: 3, payload: { users: [
    { id: 'manager', role: 'MANAGER' },
    { id: 'paid', role: 'TRAINEE', name: 'Paid', membershipType: 'GROUP_ANNUAL', membershipStatus: 'ACTIVE', membershipExpiry: '2099-12-31' }
  ], payments: [{ id: 'receipt', traineeId: 'paid', status: 'PAID', membershipTypePurchased: 'GROUP_ANNUAL', timestamp: now.toISOString() }], messages: [] } };
  const store = {
    async getSession() { return { club_id: 'test', user_id: 'manager' }; },
    async getAccount() { return { user_id: 'manager', role: 'MANAGER' }; },
    async getClubState() { return state; },
    async putClubState(_club, payload, revision) {
      assert.equal(revision, state.revision);
      writes += 1;
      state = { payload, revision: revision + 1 };
      return { conflict: false, revision: state.revision };
    }
  };
  for (let i = 0; i < 2; i++) {
    const response = await worker.fetch(new Request('https://club.test/api/state', { headers: { Cookie: 'baly_session=test' } }), { CLUB_ID: 'test', STATE_STORE: store });
    assert.equal(response.status, 200);
    assert.equal(state.payload.users[1].membershipExpiry, calendarTerm('GROUP_ANNUAL', now).membershipExpiry);
  }
  assert.equal(writes, 1);
});
