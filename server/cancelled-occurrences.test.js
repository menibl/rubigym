import test from 'node:test';
import assert from 'node:assert/strict';
import { isCancelledOccurrence } from '../shared/scheduled-occurrence.js';
import { mergePayloadForUser } from './auth.js';
import { clubArrivalChoices, recordClubArrival, CLUB_CHECK_IN_CODE } from '../shared/club-check-in.js';
import { homeGroupSessions } from '../shared/group-program-access.js';
import { changePersonalBooking } from '../shared/personal-booking.js';
import { offlinePaymentRecord } from '../shared/offline-payment.js';

const date = '2026-10-27';
const slot = (id = 'cancelled', registeredUsers = []) => ({ id, date, timeSlot: '20:00-21:00', excludedDates: [date], recurringType: 'WEEKLY_FOREVER', seriesId: 'series', registeredUsers, waitlistUsers: [], maxParticipants: 15 });
const user = { id: 'u', name: 'מתאמן לדוגמה', role: 'TRAINEE', membershipType: 'OPEN_GYM', membershipStatus: 'ACTIVE', membershipExpiry: '2026-11-01', healthDeclarationSigned: true, healthDeclarationDate: '2026-10-01' };
const payload = () => ({ users: [user], sessions: [], openGymSessions: [slot()], messages: [], attendanceLogs: [] });
const now = Date.parse('2026-10-27T18:15:00Z');

test('cancelled date does not cancel another occurrence of the same recurring series', () => {
  assert.equal(isCancelledOccurrence(slot()), true);
  assert.equal(isCancelledOccurrence({ ...slot(), date: '2026-11-03' }), false);
  assert.equal(isCancelledOccurrence({ ...slot(), excludedDates: [] }), false);
});
test('stale trainee state cannot register or waitlist a cancelled Open Gym occurrence', () => {
  const current = payload(), incoming = structuredClone(current);
  incoming.openGymSessions[0].registeredUsers = ['u']; incoming.openGymSessions[0].waitlistUsers = ['u'];
  incoming.openGymSessions[0].excludedDates = [];
  const next = mergePayloadForUser(current, incoming, 'u', 'TRAINEE');
  assert.deepEqual(next.openGymSessions[0].registeredUsers, []);
  assert.deepEqual(next.openGymSessions[0].waitlistUsers, []);
  assert.deepEqual(next.openGymSessions[0].excludedDates, [date]);
});
test('existing registrations remain auditable and cancellable without consuming the daily limit', () => {
  const current = payload(); current.openGymSessions = [slot('cancelled1', ['u']), slot('cancelled2', ['u']), { ...slot('active'), excludedDates: [] }];
  const incoming = structuredClone(current); incoming.openGymSessions[2].registeredUsers = ['u'];
  const next = mergePayloadForUser(current, incoming, 'u', 'TRAINEE');
  assert.deepEqual(next.openGymSessions[2].registeredUsers, ['u']);
  assert.deepEqual(next.openGymSessions[0].registeredUsers, ['u']);
  incoming.openGymSessions[0].registeredUsers = [];
  assert.deepEqual(mergePayloadForUser(current, incoming, 'u', 'TRAINEE').openGymSessions[0].registeredUsers, []);
});
test('a cancelled window cannot be checked into or bypassed with the no-slot Open Gym fallback', () => {
  for (const registeredUsers of [[], ['u']]) {
    const p = payload(); p.openGymSessions[0].registeredUsers = registeredUsers;
    assert.deepEqual(clubArrivalChoices(p, 'u', now), []);
    for (const targetId of ['cancelled', `drop-in-u-OPEN_GYM-${date}`]) assert.throws(() => recordClubArrival(p, 'u', { code: CLUB_CHECK_IN_CODE, type: 'OPEN_GYM', targetId, trainingType: 'OPEN_GYM', confirmUnscheduled: true }, now), /אינו זמין/);
    assert.equal(p.attendanceLogs.length, 0);
  }
});
test('another active slot is still available, and ordinary no-slot attendance is preserved', () => {
  const p = payload(); p.openGymSessions.push({ ...slot('active'), excludedDates: [] });
  assert.equal(clubArrivalChoices(p, 'u', now)[0].targetId, 'active');
  p.openGymSessions = [];
  assert.equal(clubArrivalChoices(p, 'u', now)[0].unscheduled, true);
});
test('cancelled group programs and personal sessions are not offered or debited', () => {
  const group = { id: 'group', date, time: '20:00', title: 'קבוצה', excludedDates: [date], genderRestriction: 'ALL', allowedMemberships: ['CORE_GROUPS'], registeredUsers: [], waitlistUsers: [] };
  assert.equal(homeGroupSessions({ ...user, membershipType: 'GROUP_MONTHLY' }, [group], now - 3600000).next, undefined);
  const p = payload(); p.users[0] = { ...user, membershipType: 'PERSONAL_TRAINING', personalTrainingRemaining: 5 };
  p.sessions = [{ ...group, isPersonalTraining: true, maxParticipants: 1, durationMinutes: 60 }];
  assert.throws(() => changePersonalBooking(p, 'u', { action: 'BOOK', sessionId: 'group', bookingId: 'new', type: 'SOLO' }, now - 3600000), /בוטל/);
  assert.equal(p.users[0].personalTrainingRemaining, 5);
});
test('offline money requires an explicit real amount and the actual assigned plan, no group fallback', () => {
  const payment = offlinePaymentRecord(user, 280, 'manual-test', new Date(now));
  assert.equal(payment.membershipTypePurchased, 'OPEN_GYM'); assert.equal(payment.amount, 280);
  assert.equal(payment.isMock, false); assert.equal(payment.provider, 'MANUAL');
  assert.equal(payment.date, date);
  for (const amount of [undefined, NaN, Infinity, -1, 0, 2.001]) assert.throws(() => offlinePaymentRecord(user, amount, 'x'));
  assert.throws(() => offlinePaymentRecord({ ...user, membershipType: undefined }, 500, 'x'), /לבחור מסלול/);
});
