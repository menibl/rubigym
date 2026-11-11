import test from 'node:test';
import assert from 'node:assert/strict';
import { purchaseBreakdown } from './purchase-breakdown.js';

test('grouped personal and duo prices and quantities are frozen with exact cents and discounts', () => {
  const result = purchaseBreakdown({}, { amount: 2025, groupLines: [
    { memberId: 'a', memberName: 'Anna', membershipType: 'PERSONAL_TRAINING', includedSessions: 6, label: 'Personal', baseAmount: 1200, amount: 1080, discountAmount: 120 },
    { memberId: 'a', memberName: 'Anna', membershipType: 'DUO_TRAINING', includedSessions: 3, label: 'Duo', baseAmount: 1050, amount: 945, discountAmount: 105 }
  ] }, [{ id: 'DUO_TRAINING', price: 9999 }]);
  assert.deepEqual(result.lines.map(line => [line.quantity, line.unitPrice, line.netAmount]), [[6, 200, 1080], [3, 350, 945]]);
  assert.equal(result.subtotal, 2250); assert.equal(result.discountAmount, 225); assert.equal(result.total, 2025);
});

test('single purchase separates discount and credit, not a fabricated discount for a credit', () => {
  const result = purchaseBreakdown({ userId: 'a', membershipType: 'GROUP_MONTHLY' },
    { amount: 170, creditAmount: 280, label: 'Group' }, [{ id: 'GROUP_MONTHLY', label: 'Group', price: 500 }]);
  assert.equal(result.discountAmount, 50); assert.equal(result.creditAmount, 280);
  assert.equal(result.lines[0].netAmount, 450);
});

test('family selections preserve beneficiaries, additions and counts; excluded members never appear as charged', () => {
  const result = purchaseBreakdown({}, { amount: 600, familyMemberPlans: [
    { memberId: 'a', memberName: 'A', membershipType: 'PERSONAL_TRAINING', trainingSessionsCount: 2, additionalPlans: [{ membershipType: 'DUO_TRAINING', trainingSessionsCount: 1 }] },
    { memberId: 'b', memberName: 'B', membershipType: 'OPEN_GYM', participation: 'SKIP' }
  ] }, [{ id: 'PERSONAL_TRAINING', price: 150 }, { id: 'DUO_TRAINING', price: 300 }]);
  assert.equal(result.lines.length, 2); assert.equal(result.subtotal, 600);
  assert.deepEqual(result.lines.map(line => line.quantity), [2, 1]);
  assert.equal(result.discountAmount, 0);
});

test('missing or inconsistent package prices do not become historical unit prices or negative discounts', () => {
  const missing = purchaseBreakdown({ membershipType: 'UNKNOWN' }, { amount: 100, label: 'Legacy' });
  assert.equal(missing.subtotal, undefined); assert.equal(missing.lines[0].unitPrice, undefined);
  const special = purchaseBreakdown({ membershipType: 'FAMILY_MEMBERSHIP' }, { amount: 1000 }, [{ id: 'FAMILY_MEMBERSHIP', price: 500 }]);
  assert.equal(special.discountAmount, undefined); assert.equal(special.lines[0].unitPrice, undefined);
});

test('fixed-price training packs use the charged pack base, not catalog price multiplied twice', () => {
  const result = purchaseBreakdown({ membershipType: 'PERSONAL_TRAINING' }, { amount: 900, baseAmount: 1000, includedSessions: 10 },
    [{ id: 'PERSONAL_TRAINING', price: 1000 }]);
  assert.equal(result.lines[0].quantity, 10); assert.equal(result.lines[0].unitPrice, 100);
  assert.equal(result.subtotal, 1000); assert.equal(result.discountAmount, 100);
});
