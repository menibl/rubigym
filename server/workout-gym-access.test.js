import test from 'node:test';
import assert from 'node:assert/strict';
import { hasActiveWorkoutGymMembership, preservePaidWorkoutPlan } from '../shared/workout-gym-access.js';
import { payloadForUser } from './auth.js';
const now = new Date('2026-11-13T10:00:00Z');
const base = { id: 't', role: 'TRAINEE', membershipType: 'OPEN_GYM', membershipStatus: 'ACTIVE', membershipExpiry: '2026-12-01', membershipExpiryExclusive: true };
test('workout program only, personal/duo credit and punch cards are not an Open Gym membership', () => {
  for (const type of ['WORKOUT_COACHING', 'WORKOUT_PLAN', 'PERSONAL_TRAINING', 'DUO_TRAINING', 'OPEN_PUNCH_CARD'])
    assert.equal(hasActiveWorkoutGymMembership({ ...base, membershipType: type, personalTrainingRemaining: 10 }, now), false);
  for (const type of ['OPEN_GYM', 'OPEN_MONTHLY', 'GROUP_MONTHLY', 'GROUP_ANNUAL', 'YOUTH_ONCE_WEEKLY', 'YOUTH_TWICE_WEEKLY'])
    assert.equal(hasActiveWorkoutGymMembership({ ...base, membershipType: type }, now), true);
});
test('expired, pending-payment, frozen, cancelled and failed-recurring access stays locked', () => {
  for (const patch of [{ membershipExpiry: '2026-11-13' }, { membershipExpiry: 'not-a-date' }, { membershipExpiry: '2026-99-01' },
    { registrationPaymentPending: true }, { isMembershipFrozen: true }, { cancellationEffectiveDate: '2026-11-13' },
    { membershipStatus: 'DEBT' }, { recurringMemberships: { OPEN_GYM: { status: 'PAYMENT_FAILED', endsAt: '2027-11-01' } } }])
    assert.equal(hasActiveWorkoutGymMembership({ ...base, ...patch }, now), false);
  assert.equal(hasActiveWorkoutGymMembership({ ...base, recurringMemberships: { OPEN_GYM: { status: 'PENDING_FIRST_CHARGE', endsAt: '2027-11-01' } } }, now), true);
});
test('separate gym-plan expiry is not extended by a later program expiry or another family member', () => {
  const program = { ...base, membershipType: 'WORKOUT_COACHING', membershipExpiry: '2027-05-01', secondaryMemberships: ['OPEN_GYM'] };
  assert.equal(hasActiveWorkoutGymMembership(program, now), false);
  assert.equal(hasActiveWorkoutGymMembership({ ...program, membershipPlanExpiries: { OPEN_GYM: '2026-11-01' } }, now), false);
  assert.equal(hasActiveWorkoutGymMembership({ ...program, membershipPlanExpiries: { OPEN_GYM: '2026-12-01' } }, now), true);
  assert.equal(hasActiveWorkoutGymMembership({ ...program, familyPayerId: 'active-payer' }, now), false);
  assert.equal(hasActiveWorkoutGymMembership({ ...base, membershipPlanExpiries: { OPEN_GYM: '2026-10-01' } }, now), true);
});
test('server withholds own program contents but preserves staff access and assigned group programs', () => {
  const user = { ...base, membershipType: 'WORKOUT_COACHING', membershipExpiry: '2099-01-01' };
  const payload = { users: [user], workoutPlans: [{ id: 'private', traineeId: 't', exercises: [{ name: 'PRIVATE' }] }],
    nutritionPlans: [{ id: 'nutrition', traineeId: 't' }], groupWorkoutPrograms: [], sessions: [], announcementSmsDeliveries: [{ phone: 'private' }] };
  assert.deepEqual(payloadForUser(payload, 't', 'TRAINEE').workoutPlans, []);
  assert.equal(payloadForUser(payload, 't', 'TRAINEE').nutritionPlans.length, 1);
  assert.deepEqual(payloadForUser(payload, 't', 'TRAINEE').announcementSmsDeliveries, []);
  assert.equal(payloadForUser(payload, 'manager', 'MANAGER').workoutPlans.length, 1);
  payload.users[0] = { ...user, membershipType: 'GROUP_MONTHLY' };
  assert.equal(payloadForUser(payload, 't', 'TRAINEE').workoutPlans.length, 1);
});
test('buying a required gym membership preserves the already-paid standalone program and its original term', () => {
  const user = { ...base, membershipType: 'WORKOUT_COACHING', membershipExpiry: '2027-02-01' };
  assert.deepEqual(preservePaidWorkoutPlan(user, 'OPEN_GYM', now), { secondaryMemberships: ['WORKOUT_COACHING'], membershipPlanExpiries: { WORKOUT_COACHING: '2027-02-01' } });
  assert.deepEqual(preservePaidWorkoutPlan({ ...user, membershipExpiry: '2026-10-01' }, 'OPEN_GYM', now), {});
  assert.deepEqual(preservePaidWorkoutPlan(user, 'NUTRITION_COACHING', now), {});
});
