import test from 'node:test';
import assert from 'node:assert/strict';
import { changePersonalBooking, personalStart } from '../shared/personal-booking.js';
import { mergePayloadForUser } from './auth.js';
import worker from './index.js';

const now = Date.parse('2026-10-03T09:00:00Z');
const fixture = () => ({
  settings: { cancellationWindowHours: 2 }, messages: [], openGymSessions: [],
  users: [
    { id: 'anna', name: 'אנה', role: 'TRAINEE', familyId: 'family', isFamilyPayer: true,
      membershipType: 'PERSONAL_TRAINING', secondaryMemberships: ['DUO_TRAINING'],
      membershipStatus: 'ACTIVE', membershipExpiry: '2026-11-01',
      personalTrainingRemaining: 4, duoTrainingRemaining: 6,
      healthDeclarationSigned: true, healthDeclarationDate: '2026-09-01' },
    { id: 'gal', name: 'גל', role: 'TRAINEE', familyId: 'family',
      healthDeclarationSigned: true, healthDeclarationDate: '2026-09-01', duoTrainingRemaining: 0 },
    { id: 'coach', role: 'COACH', name: 'מאמן' }
  ],
  sessions: [{ id: 's', title: 'אימון אישי', isPersonalTraining: true, date: '2026-10-04', time: '17:00',
    durationMinutes: 60, coachId: 'coach', genderRestriction: 'ALL', maxParticipants: 1,
    registeredUsers: [], waitlistUsers: [], allowedMemberships: ['PERSONAL_TRAINING'] }]
});
const duo = { action: 'BOOK', type: 'DUO', partnerId: 'gal', sessionId: 's', bookingId: 'booking-1' };
const cancel = { action: 'CANCEL', sessionId: 's', bookingId: 'booking-1' };

test('duo registers both and debits only the payer; retries are idempotent', () => {
  const initial = fixture();
  const next = changePersonalBooking(initial, 'anna', duo, now);
  assert.equal(initial.users[0].duoTrainingRemaining, 6);
  assert.equal(next.users[0].duoTrainingRemaining, 5);
  assert.equal(next.users[0].personalTrainingRemaining, 4);
  assert.equal(next.users[1].duoTrainingRemaining, 0);
  assert.deepEqual(next.sessions[0].registeredUsers, ['anna', 'gal']);
  assert.equal(next.sessions[0].maxParticipants, 2);
  assert.equal(changePersonalBooking(next, 'anna', duo, now), next);
  assert.equal(next.messages.length, 2);
});

test('solo debits personal card and cannot turn into duo by another registration', () => {
  const next = changePersonalBooking(fixture(), 'anna', { ...duo, type: 'SOLO' }, now);
  assert.equal(next.users[0].personalTrainingRemaining, 3);
  assert.equal(next.users[0].duoTrainingRemaining, 6);
  assert.deepEqual(next.sessions[0].registeredUsers, ['anna']);
  assert.throws(() => changePersonalBooking(next, 'gal', { ...duo, bookingId: 'other' }, now), /תפוס/);
});

test('partner cancellation refunds only original payer/card exactly once', () => {
  const booked = changePersonalBooking(fixture(), 'anna', duo, now);
  const next = changePersonalBooking(booked, 'gal', cancel, now);
  assert.equal(next.users[0].duoTrainingRemaining, 6);
  assert.equal(next.users[1].duoTrainingRemaining, 0);
  assert.deepEqual(next.sessions[0].registeredUsers, []);
  assert.equal(next.sessions[0].maxParticipants, 1);
  assert.equal(changePersonalBooking(next, 'gal', cancel, now), next);
  assert.throws(() => changePersonalBooking(next, 'anna', duo, now), /בוטלה/);
  const rebooked = changePersonalBooking(next, 'anna', { ...duo, bookingId: 'second' }, now);
  assert.throws(() => changePersonalBooking(rebooked, 'anna', cancel, now), /השתנתה/);
});

test('late cancellation requires acknowledgement and never refunds', () => {
  const booked = changePersonalBooking(fixture(), 'anna', duo, now);
  const late = personalStart(booked.sessions[0]) - 3600000;
  assert.throws(() => changePersonalBooking(booked, 'anna', cancel, late), /LATE_PERSONAL/);
  const next = changePersonalBooking(booked, 'anna', { ...cancel, acknowledgeLate: true }, late);
  assert.equal(next.users[0].duoTrainingRemaining, 5);
  assert.equal(next.sessions[0].personalBooking.refunded, false);
  assert.throws(() => changePersonalBooking(booked, 'anna', cancel, late + 3600000), /כבר התחיל/);
});

test('rejects absent credit, invalid partner, missing health, overlapping booking and frozen membership', () => {
  for (const mutate of [
    p => { p.users[0].duoTrainingRemaining = 0; },
    p => { p.users[1].familyId = 'other'; },
    p => { p.users[1].healthDeclarationSigned = false; },
    p => { p.users[1].isMembershipFrozen = true; },
    p => { p.sessions.push({ ...p.sessions[0], id: 'conflict', registeredUsers: ['gal'] }); },
    p => { p.users[0].registrationPaymentPending = true; },
    p => { p.users[0].cancellationEffectiveDate = '2026-10-01'; }
  ]) {
    const p = fixture(); mutate(p);
    assert.throws(() => changePersonalBooking(p, 'anna', duo, now));
    assert.equal(p.sessions[0].registeredUsers.length, 0);
  }
  assert.throws(() => changePersonalBooking(fixture(), 'anna', { ...duo, partnerId: 'anna' }, now));
});

test('legacy state writes cannot undo or bypass atomic reservations/debits', () => {
  const initial = fixture();
  const booked = changePersonalBooking(initial, 'anna', duo, now);
  const stale = mergePayloadForUser(booked, initial, 'anna', 'TRAINEE');
  assert.equal(stale.users[0].duoTrainingRemaining, 5);
  assert.deepEqual(stale.sessions[0].registeredUsers, ['anna', 'gal']);
  const bypass = mergePayloadForUser(initial, { ...initial, sessions: booked.sessions }, 'anna', 'TRAINEE');
  assert.deepEqual(bypass.sessions[0].registeredUsers, []);
});

test('staff creates and books atomically, without charging partner', () => {
  const p = fixture();
  const input = { ...duo, sessionId: 'new', payerId: 'anna', newSession: { ...p.sessions[0], id: 'new', time: '19:00' } };
  const next = changePersonalBooking(p, 'coach', input, now);
  assert.equal(next.sessions.length, 2);
  assert.equal(next.users[0].duoTrainingRemaining, 5);
  assert.equal(next.users[1].duoTrainingRemaining, 0);
  assert.equal(changePersonalBooking(next, 'coach', input, now), next);
  assert.throws(() => changePersonalBooking(p, 'anna', input, now), /הרשאה/);
});

test('API authenticates, retries revision conflicts and cannot debit twice', async () => {
  let state = { payload: fixture(), revision: 1 };
  state.payload.sessions[0].date = '2099-10-04';
  state.payload.users[0].membershipExpiry = '2099-11-01';
  state.payload.users.forEach(u => { u.healthDeclarationDate = new Date().toISOString().slice(0, 10); });
  let conflict = true;
  const env = { CLUB_ID: 'test', STATE_STORE: {
    getSession: async () => ({ club_id: 'test', user_id: 'anna' }),
    getAccount: async () => ({ user_id: 'anna', role: 'TRAINEE' }),
    getClubState: async () => state,
    putClubState: async (_club, payload, revision) => {
      assert.equal(revision, state.revision);
      if (conflict) { conflict = false; return { conflict: true }; }
      state = { payload, revision: state.revision + 1 }; return { conflict: false };
    }
  } };
  const post = cookie => worker.fetch(new Request('https://club.test/api/bookings/personal', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: 'baly_session=test' } : {}) }, body: JSON.stringify(duo)
  }), env);
  assert.equal((await post(false)).status, 401);
  const response = await post(true);
  assert.equal(response.status, 200, await response.text());
  assert.equal((await post(true)).status, 200);
  assert.equal(state.payload.users[0].duoTrainingRemaining, 5);
});
