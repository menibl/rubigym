import test from 'node:test';
import assert from 'node:assert/strict';
import { assignTraineeFamily, recordedDiscount, traineePayments } from '../shared/admin-trainees.js';

const users = () => [
  { id: 'payer', role: 'TRAINEE', name: 'ראש משפחה', familyId: 'fam', familyName: 'משפחה', isFamilyPayer: true, familyMemberPlans: [] },
  { id: 'child', role: 'TRAINEE', name: 'בן משפחה', membershipType: 'YOUTH_ONCE_WEEKLY', membershipStatus: 'ACTIVE', membershipExpiry: '2026-11-01' },
];
test('link to an existing payer preserves paid plan and term, adds a real selectable family member', () => {
  const input = users();
  const result = assignTraineeFamily(input, 'child', 'payer');
  assert.equal(result[1].familyPayerId, 'payer');
  assert.equal(result[1].familyId, 'fam');
  assert.equal(result[1].membershipType, input[1].membershipType);
  assert.equal(result[1].membershipStatus, 'ACTIVE');
  assert.equal(result[1].membershipExpiry, input[1].membershipExpiry);
  assert.equal(result[0].familyMembersCount, 2);
  assert.equal(result[0].familyMemberPlans.find(plan => plan.memberId === 'child').participation, 'SKIP');
  assert.equal(input[1].familyId, undefined);
});
test('pending members retain debt; reassigning cleans the old payer selections', () => {
  const input = users();
  input[1].membershipStatus = 'DEBT';
  const linked = assignTraineeFamily(input, 'child', 'payer');
  assert.equal(linked[1].membershipStatus, 'DEBT');
  assert.equal(linked[0].familyMemberPlans[1].participation, 'INCLUDED');
  const unlinked = assignTraineeFamily(linked, 'child', '');
  assert.equal(unlinked[1].familyPayerId, undefined);
  assert.equal(unlinked[0].familyMembersCount, 1);
  assert.equal(unlinked[0].familyMemberPlans.length, 1);
});
test('cannot move a responsible payer or link to a nonexistent family', () => {
  const input = assignTraineeFamily(users(), 'child', 'payer');
  assert.throws(() => assignTraineeFamily(input, 'payer', ''), /האחריות/);
  assert.throws(() => assignTraineeFamily(input, 'child', 'missing'), /משלם/);
});
test('family reassignment preserves both families and enforces six-member capacity', () => {
  const input = assignTraineeFamily(users(), 'child', 'payer');
  input.push({ id: 'payer2', role: 'TRAINEE', name: 'אחר', isFamilyPayer: true, familyId: 'fam2' });
  const moved = assignTraineeFamily(input, 'child', 'payer2');
  assert.equal(moved[0].familyMemberPlans.length, 1);
  assert.equal(moved[2].familyMembersCount, 2);
  for (let i = 0; i < 5; i++) input.push({ id: `extra${i}`, role: 'TRAINEE', familyId: 'fam2' });
  assert.throws(() => assignTraineeFamily(input, 'child', 'payer2'), /שישה/);
});
test('payment display uses stored amounts, retains distinct real purchases, excludes other users and deduplicates exact provider ids', () => {
  const payments = [
    { id: 'one', traineeId: 'u', providerTransactionId: 'tx1', amount: 280, date: '2026-10-01' },
    { id: 'copy', traineeId: 'u', providerTransactionId: 'tx1', amount: 280, date: '2026-10-01' },
    { id: 'two', traineeId: 'u', providerTransactionId: 'tx2', amount: 280, date: '2026-10-02' },
    { id: 'other', traineeId: 'v', amount: 500, date: '2026-10-02' },
  ];
  assert.deepEqual(traineePayments(payments, 'u').map(payment => payment.amount), [280, 280]);
  assert.equal(payments[0].id, 'one');
});
test('discount display uses receipt or exact historical payment association, never guesses from user id', () => {
  const discounts = [{ code: 'OLD20', usedBy: 'u', usedByPaymentId: 'tx' }];
  assert.equal(recordedDiscount({ id: 'payment-rivhit-tx' }, discounts), 'OLD20');
  assert.equal(recordedDiscount({ id: 'other', traineeId: 'u' }, discounts), undefined);
  assert.equal(recordedDiscount({ discountCode: 'NEW10' }, discounts), 'NEW10');
  assert.equal(recordedDiscount({ discountCode: null }, discounts), null);
});
