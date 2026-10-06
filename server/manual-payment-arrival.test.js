import test from 'node:test';
import assert from 'node:assert/strict';
import { approveOfflinePayment, revokeOfflinePayment, clearManualPaymentPending } from '../shared/registration-status.js';
import { clubArrivalChoices, recordClubArrival, CLUB_CHECK_IN_CODE } from '../shared/club-check-in.js';
import { mergePayloadForUser } from './auth.js';

const now = Date.parse('2026-10-06T09:00:00Z');
const fixture = () => ({ users: [{ id: 'u', name: 'AS', role: 'TRAINEE', membershipType: 'PERSONAL_TRAINING', membershipStatus: 'DEBT',
  membershipExpiry: '2026-11-01', registrationPaymentPending: true, familyPaymentPending: true,
  personalTrainingRemaining: 5, healthDeclarationSigned: true, healthDeclarationDate: '2026-10-01' }], sessions: [], openGymSessions: [], attendanceLogs: [] });

test('manual approval clears only payment flags and scanner debits once without calendar', () => {
  const state = fixture();
  assert.throws(() => clubArrivalChoices(state, 'u', now), /להשלים רישום ותשלום/);
  const approved = approveOfflinePayment(state.users[0]); state.users[0] = approved;
  assert.equal(approved.registrationPaymentPending, false); assert.equal(approved.familyPaymentPending, false);
  assert.equal(approved.membershipExpiry, '2026-11-01');
  const choice = clubArrivalChoices(state, 'u', now)[0];
  const next = recordClubArrival(state, 'u', { ...choice, code: CLUB_CHECK_IN_CODE }, now);
  assert.equal(next.users[0].personalTrainingRemaining, 4);
  assert.equal(recordClubArrival(next, 'u', { ...choice, code: CLUB_CHECK_IN_CODE }, now), next);
});

test('legacy approval with stale pending flags is honored but ordinary ACTIVE is not payment approval', () => {
  const state = fixture(); state.users[0].membershipStatus = 'ACTIVE';
  assert.throws(() => clubArrivalChoices(state, 'u', now));
  state.users[0].offlinePaymentApproved = true;
  assert.equal(clubArrivalChoices(state, 'u', now)[0].trainingType, 'SOLO');
});

test('manual approval cannot bypass incomplete profile, health, expiry, freeze or absent card credit', () => {
  for (const update of [{ registrationIncomplete: true }, { healthDeclarationSigned: false }, { membershipExpiry: '2026-10-01' }, { isMembershipFrozen: true }]) {
    const state = fixture(); state.users[0] = approveOfflinePayment({ ...state.users[0], ...update });
    assert.throws(() => clubArrivalChoices(state, 'u', now));
  }
  const state = fixture(); state.users[0] = approveOfflinePayment({ ...state.users[0], personalTrainingRemaining: 0 });
  assert.deepEqual(clubArrivalChoices(state, 'u', now), []);
});

test('revoking exception restores pending payment while recorded payment clears the pending state', () => {
  const original = fixture().users[0];
  const revoked = revokeOfflinePayment(approveOfflinePayment(original));
  assert.equal(revoked.registrationPaymentPending, true); assert.equal(revoked.familyPaymentPending, true);
  assert.equal(revoked.membershipStatus, 'DEBT');
  const paid = clearManualPaymentPending({ ...original, registrationIncomplete: true });
  assert.equal(paid.registrationIncomplete, true); assert.equal(paid.registrationPaymentPending, false);
  assert.equal(paid.familyPaymentPending, false);
});

test('trainee cannot self-approve payment via generic state sync', () => {
  const state = fixture();
  const incoming = { ...state, users: [approveOfflinePayment(state.users[0])] };
  const merged = mergePayloadForUser(state, incoming, 'u', 'TRAINEE');
  assert.equal(merged.users[0].offlinePaymentApproved, undefined);
  assert.equal(merged.users[0].registrationPaymentPending, true);
  assert.equal(merged.users[0].membershipStatus, 'DEBT');
});
