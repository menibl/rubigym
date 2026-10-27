import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TraineePaymentSummary } from './TraineePaymentSummary';
import { MembershipType, type User, type Payment } from '../types';
const user = { id: 'trainee', membershipType: MembershipType.OPEN_GYM, offlinePaymentApproved: true } as User;
const payment = { id: 'test-group', traineeId: user.id, amount: 500, status: 'PAID', date: '2026-10-27', membershipTypePurchased: MembershipType.GROUP_MONTHLY, isMock: true } as Payment;
const render = (payments: Payment[], member = user) => renderToStaticMarkup(<TraineePaymentSummary user={member} payments={payments} discounts={[]} plans={[]} />);
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
