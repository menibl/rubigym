import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { membershipStatusLabel, TraineeMembershipStatus } from './TraineeMembershipStatus';
import { MembershipStatus, type User } from '../types';
const user = { id: 'u', name: 'מתאמן לדוגמה', membershipStatus: MembershipStatus.ACTIVE, membershipExpiry: '2026-11-01', membershipExpiryExclusive: true } as User;
const today = '2026-10-27';
test('active status is explicitly an entitlement setting, never a payment receipt', () => {
  assert.equal(membershipStatusLabel(user, today), 'מנוי פעיל לפי הגדרת המערכת');
  const html = renderToStaticMarkup(<TraineeMembershipStatus user={user} />);
  assert.doesNotMatch(html, /שולם/); assert.match(html, /2026-11-01/); assert.match(html, /בתחילת התאריך/);
});
test('manual approval, expired approval, freeze and cancellation take precedence over active status', () => {
  assert.equal(membershipStatusLabel({ ...user, offlinePaymentApproved: true }, today), 'אישור חריג מנהל — בתוקף');
  assert.equal(membershipStatusLabel({ ...user, offlinePaymentApproved: true, membershipExpiry: '2026-10-01' }, today), 'תוקף המנוי פג');
  assert.equal(membershipStatusLabel({ ...user, isMembershipFrozen: true }, today), 'המנוי מוקפא');
  assert.equal(membershipStatusLabel({ ...user, cancellationEffectiveDate: today }, today), 'המנוי בוטל');
});
test('missing or invalid expiry cannot be displayed as an active paid term', () => {
  for (const expiry of [undefined, 'invalid', '2026-02-30']) assert.equal(membershipStatusLabel({ ...user, membershipExpiry: expiry }, today), 'תוקף מנוי לא הוגדר');
});
test('explicit exclusive expiry is expired on the first, legacy inclusive expiry remains valid that day', () => {
  assert.equal(membershipStatusLabel(user, '2026-11-01'), 'תוקף המנוי פג');
  assert.equal(membershipStatusLabel({ ...user, membershipExpiryExclusive: false }, '2026-11-01'), 'מנוי פעיל לפי הגדרת המערכת');
});
test('manual override and not-paying exemption are labelled, not inferred as receipts', () => {
  const html = renderToStaticMarkup(<TraineeMembershipStatus user={{ ...user, offlinePaymentApproved: true, membershipExpiryManualOverride: true, paymentReminderExempt: true }} />);
  assert.match(html, /אינו הוכחת תשלום/); assert.match(html, /אינו מעיד כשלעצמו/); assert.match(html, /תזכורות תשלום כבויות/);
});
