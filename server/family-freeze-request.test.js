import test from 'node:test';
import assert from 'node:assert/strict';
import { mergePayloadForUser } from './auth.js';

test('payer may request dependent freeze but cannot approve it or modify expiry', () => {
  const current = { users: [
    { id: 'p', role: 'TRAINEE', familyId: 'f', isFamilyPayer: true },
    { id: 'c', role: 'TRAINEE', familyId: 'f', familyPayerId: 'p', membershipStatus: 'ACTIVE', membershipExpiry: '2099-01-01' },
    { id: 'other', role: 'TRAINEE' }
  ] };
  const timestamp = new Date().toISOString();
  const incoming = structuredClone(current);
  Object.assign(incoming.users[1], { membershipFreezeRequestedAt: timestamp, isMembershipFrozen: true, membershipExpiry: '2100-01-01' });
  incoming.users[2].membershipFreezeRequestedAt = timestamp;
  const merged = mergePayloadForUser(current, incoming, 'p', 'TRAINEE');
  assert.equal(merged.users[1].membershipFreezeRequestedAt, timestamp);
  assert.equal(merged.users[1].isMembershipFrozen, undefined);
  assert.equal(merged.users[1].membershipExpiry, '2099-01-01');
  assert.equal(merged.users[2].membershipFreezeRequestedAt, undefined);
  merged.users[1].membershipFreezeRequestedAt = undefined;
  merged.users[1].membershipFreezeDecisionAt = timestamp;
  assert.equal(mergePayloadForUser(merged, incoming, 'p', 'TRAINEE').users[1].membershipFreezeRequestedAt, undefined);
});

test('frozen member cannot add bookings while freeze is active', () => {
  const current = { users: [{ id: 'c', role: 'TRAINEE', membershipStatus: 'ACTIVE', isMembershipFrozen: true, membershipFrozenUntil: '2099-12-31' }], sessions: [{ id: 's', registeredUsers: [] }], openGymSessions: [{ id: 'o', registeredUsers: [] }] };
  const incoming = structuredClone(current);
  incoming.sessions[0].registeredUsers.push('c');
  incoming.openGymSessions[0].registeredUsers.push('c');
  const merged = mergePayloadForUser(current, incoming, 'c', 'TRAINEE');
  assert.deepEqual(merged.sessions[0].registeredUsers, []);
  assert.deepEqual(merged.openGymSessions[0].registeredUsers, []);
});
