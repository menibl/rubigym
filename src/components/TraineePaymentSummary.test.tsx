import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TraineePaymentSummary } from './TraineePaymentSummary';
import { MembershipType, type User, type Payment } from '../types';
const user = { id: 'trainee', membershipType: MembershipType.OPEN_GYM, offlinePaymentApproved: true } as User;
const payment = { id: 'test-group', traineeId: user.id, amount: 500, status: 'PAID', date: '2026-10-27', membershipTypePurchased: MembershipType.GROUP_MONTHLY, isMock: true } as Payment;
const render = (payments: Payment[], member = user) => renderToStaticMarkup(<TraineePaymentSummary user={member} payments={payments} discounts={[]} plans={[]} now={new Date('2026-10-28T12:00:00Z')} />);
test('Open Gym cash approval does not display a 500 group mock as money actually received', () => {
  const html = render([payment]);
  assert.doesNotMatch(html, /שולם בפועל/);
  assert.match(html, /ללא סכום מתועד/);
  assert.match(html, /אישור ידני למנוי הנוכחי: Open Gym/);
  assert.match(html, /תשלומי בדיקה — לא כסף שהתקבל/);
  assert.match(html, /בדיקה בלבד: ₪500/);
});
test('real historical transactions keep their amounts and original plans, labelled as history', () => {
  const html = render([{ ...payment, isMock: false }]);
  assert.match(html, /שולם בפועל.*₪500/);
  assert.match(html, /היסטוריית תשלומים מתועדים/);
  assert.match(html, /אינה קובעת את המסלול הנוכחי/);
});
test('real Open Gym cash payments show the recorded amount rather than another plan catalog price', () => {
  const html = render([{ ...payment, id: 'cash', amount: 280, isMock: false, provider: 'MANUAL', membershipTypePurchased: MembershipType.OPEN_GYM }]);
  assert.match(html, /שולם בפועל.*₪280/); assert.doesNotMatch(html, /₪500/);
});
test('family mock transactions cannot become a real family member payment', () => {
  const html = render([{ ...payment, traineeId: 'payer', familyMemberPlans: [{ memberId: user.id, participation: 'INCLUDED' }] } as Payment], { ...user, familyPayerId: 'payer' });
  assert.doesNotMatch(html, /עסקה משפחתית כוללת/); assert.doesNotMatch(html, /שולם בפועל/);
});

test('current Open Gym does not inherit money from a real historical group purchase', () => {
  const html = render([{ ...payment, isMock: false }], { ...user, offlinePaymentApproved: false });
  assert.match(html, /לא תועד תשלום שהושלם למסלול זה/);
  assert.match(html, /היסטוריית תשלומים/);
});
test('pending and refunded payments are not displayed as paid; legacy simulated methods stay test-only', () => {
  const html = render([{ ...payment, isMock: false, status: 'PENDING', membershipTypePurchased: MembershipType.OPEN_GYM }, { ...payment, id: 'refund', isMock: false, status: 'REFUNDED', membershipTypePurchased: MembershipType.OPEN_GYM }]);
  assert.doesNotMatch(html, /שולם בפועל|תשלום מתועד אחרון/); assert.match(html, /בקשת תשלום ממתינה/); assert.match(html, /תיעוד החזר/);
  assert.doesNotMatch(render([{ ...payment, isMock: false, paymentMethod: 'סליקה מדומה (כרטיס אשראי)' }]), /שולם בפועל/);
});
test('family additional plan payment is acknowledged without attributing the entire family amount to the child', () => {
  const html = render([{ ...payment, isMock: false, traineeId: 'payer', membershipTypePurchased: MembershipType.FAMILY_MEMBERSHIP, amount: 800,
    familyMemberPlans: [{ memberId: user.id, membershipType: MembershipType.GROUP_MONTHLY, additionalPlans: [{ membershipType: MembershipType.OPEN_GYM }], participation: 'INCLUDED' }] } as Payment], { ...user, familyPayerId: 'payer' });
  assert.match(html, /נכלל בתשלום משפחתי מתועד/); assert.match(html, /עסקה משפחתית כוללת.*₪800/);
  assert.doesNotMatch(html, /תשלום מתועד אחרון: ₪800/);
});

test('missing balances, amounts and secondary expiry are reported as unknown, not fabricated', () => {
  const html = render([{ ...payment, isMock: false, amount: undefined, membershipTypePurchased: MembershipType.OPEN_GYM } as unknown as Payment], { ...user, secondaryMemberships: [MembershipType.PERSONAL_TRAINING] });
  assert.match(html, /סכום לא תועד/); assert.doesNotMatch(html, /NaN|₪0/);
  assert.match(html, /לא תועדה יתרה תקינה/); assert.match(html, /לא תועד/);
});

test('admin card lists current program plus receipt-proven Open Gym with independent expiry', () => {
  const member = { ...user, membershipType: MembershipType.WORKOUT_PLAN, offlinePaymentApproved: false, membershipExpiry: '2027-01-28' };
  const html = render([
    { ...payment, id: 'program', isMock: false, membershipTypePurchased: MembershipType.WORKOUT_PLAN, amount: 300, date: '2026-10-28' },
    { ...payment, id: 'open', isMock: false, membershipTypePurchased: MembershipType.OPEN_GYM, amount: 280, date: '2026-10-28' },
  ], member);
  assert.match(html, /מסלול ראשי/);
  assert.match(html, /תוספת לפי רכישה מתועדת/); assert.match(html, /Open Gym/);
  assert.match(html, /2026-11-01/); assert.match(html, /2027-01-28/); assert.match(html, /₪280/); assert.match(html, /₪300/);
});
