import test from 'node:test';
import assert from 'node:assert/strict';
import { quoteFamilyCredit } from './family-credit.js';
import { familyPlanAmount } from '../shared/family-pricing.js';

test('two Open Gym members pay 560 with a 280 credit, without family discount', () => {
  const packageAmount = familyPlanAmount('OPEN_GYM', 280) * 2;
  assert.equal(packageAmount, 560);
  assert.equal(quote({ packageAmount }).amountDue, 280);
});

test('mixed family discounts only group memberships', () => {
  assert.equal(familyPlanAmount('GROUP_ANNUAL', 500) * 2 + familyPlanAmount('OPEN_GYM', 280) * 2, 1460);
  assert.equal(familyPlanAmount('GROUP_MONTHLY', 600), 540);
  assert.equal(familyPlanAmount('NUTRITION_COACHING', 350), 350);
  assert.equal(familyPlanAmount('PERSONAL_TRAINING', 800), 800);
});

const user = { id: 'payer', membershipType: 'OPEN_GYM', membershipStatus: 'ACTIVE', membershipExpiry: '2026-10-31T23:59:59Z' };
const payment = { id: 'paid', traineeId: 'payer', membershipTypePurchased: 'OPEN_GYM', purchaseMode: 'PRIMARY', status: 'PAID', amount: 280, provider: 'RIVHIT', providerTransactionId: 'transaction', timestamp: '2026-10-01T09:00:00Z' };
const quote = (overrides = {}) => quoteFamilyCredit({ user, payments: [payment], packageAmount: 900, now: Date.parse('2026-10-20T12:00:00Z'), ...overrides });

test('credits the full last payment, without prorating consumed days', () => {
  assert.deepEqual(quote(), { packageAmount: 900, creditAmount: 280, amountDue: 620, sourcePaymentId: 'paid' });
});
test('never credits addons, another member, mock production payments or unverified records', () => {
  for (const patch of [{ purchaseMode: 'ADDON' }, { traineeId: 'other' }, { isMock: true }, { provider: undefined }, { providerTransactionId: undefined }, { status: 'REFUNDED' }, { refundedAt: '2026-10-02' }, { familyCreditUsedBy: 'upgrade' }, { familyCreditReservedBy: 'pending' }]) {
    assert.equal(quote({ payments: [{ ...payment, ...patch }] }).creditAmount, 0);
  }
});
test('does not resurrect an older credit after the newest payment is consumed', () => {
  assert.equal(quote({ payments: [payment, { ...payment, id: 'new', timestamp: '2026-10-02T09:00:00Z', familyCreditUsedBy: 'upgrade' }] }).creditAmount, 0);
});
test('expired and dependent memberships do not receive payer credit', () => {
  for (const patch of [{ membershipExpiry: '2026-09-30' }, { membershipExpiry: undefined }, { familyPayerId: 'another' }, { membershipStatus: 'DEBT' }]) {
    assert.equal(quote({ user: { ...user, ...patch } }).creditAmount, 0);
  }
});
test('caps credit at package price, without generating a refund or rounding errors', () => {
  assert.equal(quote({ packageAmount: 200 }).amountDue, 0);
  assert.equal(quote({ packageAmount: 900.1 }).amountDue, 620.1);
  assert.throws(() => quote({ packageAmount: -1 }), /INVALID_FAMILY_PRICE/);
});
