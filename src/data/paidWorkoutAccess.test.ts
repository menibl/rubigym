import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hasPaidWorkoutPlanAccess } from '../../shared/paid-workout-access.js';

test('server projection and receipt fallback expire without mutating the profile', () => {
  const now = new Date('2026-11-17T12:00:00Z');
  assert.equal(hasPaidWorkoutPlanAccess({ id: 'u', workoutPlanPurchaseAccessUntil: '2027-01-06' }, [], now), true);
  assert.equal(hasPaidWorkoutPlanAccess({ id: 'u', workoutPlanPurchaseAccessUntil: '2026-11-16' }, [], now), false);
  assert.equal(hasPaidWorkoutPlanAccess({ id: 'u', workoutPlanPurchaseAccessUntil: '2026-99-01' }, [], now), false);
  assert.equal(hasPaidWorkoutPlanAccess({ id: 'u' }, [{ id: 'p', traineeId: 'u', status: 'PAID', date: '2026-10-06', billingTermMonths: 3, membershipTypePurchased: 'WORKOUT_COACHING' }], now), true);
});

test('all trainee program navigation shares receipt-aware access while retaining the separate gym gate', () => {
  const source = readFileSync(new URL('../components/TraineeDashboard.tsx', import.meta.url), 'utf8');
  assert.match(source, /const hasWorkoutPlanAccess = Boolean\(\s*hasPaidWorkoutPlanAccess\(activeUser, payments\) \|\|/);
  assert.match(source, /if \(tab === 'workout' && !hasWorkoutGymMembership\)/);
  assert.match(source, /initialTab === 'workout' && hasWorkoutGymMembership && !hasWorkoutPlanAccess/);
  assert.match(source, /!hasWorkoutGymMembership/);
});
