import assert from 'node:assert/strict';
import test from 'node:test';
import { familyPurchaseIdentity, repairPaidFamilyOwners } from './family-purchase.js';

test('paid family owner missing identity is repaired without charging or changing quota', () => {
  const payload = { users: [{ id: 'u', name: 'Test', role: 'TRAINEE', membershipType: 'FAMILY_MEMBERSHIP', familyMembersCount: 2 }], payments: [{ id: 'p', traineeId: 'u', membershipTypePurchased: 'FAMILY_MEMBERSHIP', status: 'PAID', amount: 900 }] };
  const result = repairPaidFamilyOwners(payload);
  assert.equal(result.changed, true);
  assert.equal(result.payload.users[0].isFamilyPayer, true);
  assert.equal(result.payload.users[0].familyId, 'fam-u');
  assert.equal(result.payload.users[0].familyMembersCount, 2);
  assert.deepEqual(result.payload.payments, payload.payments);
  assert.equal(repairPaidFamilyOwners(result.payload).changed, false);
});

test('repair requires purchase proof and does not guess capacity or promote dependents', () => {
  const paid = { traineeId: 'u', membershipTypePurchased: 'FAMILY_MEMBERSHIP', status: 'PAID' };
  const user = { id: 'u', role: 'TRAINEE', membershipType: 'FAMILY_MEMBERSHIP', familyMembersCount: 2 };
  assert.equal(repairPaidFamilyOwners({ users: [user], payments: [] }).changed, false);
  assert.equal(repairPaidFamilyOwners({ users: [{ ...user, familyMembersCount: undefined }], payments: [paid] }).changed, false);
  assert.equal(repairPaidFamilyOwners({ users: [{ ...user, familyPayerId: 'other' }], payments: [paid] }).changed, false);
});

test('new purchases have stable server-owned family identity including custom plans', () => {
  const fields = familyPurchaseIdentity({ id: 'payer', name: 'Payer' }, { m: 'FAMILY_MEMBERSHIP', f: 2, fm: 'CUSTOM_COMBINED', fn: 'משפחת בדיקה', fp: [] });
  assert.equal(fields.familyId, 'fam-payer');
  assert.equal(fields.familyName, 'משפחת בדיקה');
  assert.equal(fields.familyMembersCount, 2);
  assert.equal(fields.isFamilyPayer, true);
});
