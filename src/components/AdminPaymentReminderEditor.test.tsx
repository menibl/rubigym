import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdminPaymentReminderEditor, updatePaymentReminderSettings } from './AdminPaymentReminderEditor';
import { MembershipType, UserRole, type User } from '../types';
const user = { id: 'member', name: 'לדוגמה', role: UserRole.TRAINEE, membershipType: MembershipType.OPEN_GYM, membershipExpiry: '2026-11-01', membershipExpiryExclusive: true, personalTrainingRemaining: 6 } as User;

test('manager can extend a specific expiry cycle without changing payments, credits or access', () => {
  const result = updatePaymentReminderSettings(user, false, '2026-12-01', '2026-11-20');
  assert.equal(result.paymentReminderUntil, '2026-12-01'); assert.equal(result.paymentReminderExpiry, '2026-11-01');
  assert.equal(result.membershipExpiry, user.membershipExpiry); assert.equal(result.personalTrainingRemaining, 6);
  assert.equal(result.membershipStatus, undefined);
});
test('not-paying stops reminders without granting access, can be undone and defaults restored', () => {
  const stopped = updatePaymentReminderSettings(user, true, '', '2026-11-01');
  assert.equal(stopped.paymentReminderExempt, true); assert.equal(stopped.membershipStatus, undefined);
  const reset = updatePaymentReminderSettings(stopped, false, '', '2026-11-01');
  assert.equal(reset.paymentReminderExempt, false); assert.equal(reset.paymentReminderUntil, '');
});
test('invalid, past and missing-expiry extensions are rejected', () => {
  for (const date of ['2026-02-30', '2026-10-01', 'invalid']) assert.throws(() => updatePaymentReminderSettings(user, false, date, '2026-11-01'));
  assert.throws(() => updatePaymentReminderSettings({ ...user, membershipExpiry: undefined }, false, '2026-12-01', '2026-11-01'));
});
test('mobile editor has descriptive date label, pause control and bounded extension shortcuts', () => {
  const html = renderToStaticMarkup(<AdminPaymentReminderEditor user={user} onSave={() => {}} />);
  for (const text of ['תזכורות תשלום עד תאריך עבור לדוגמה', 'עוד שבוע', 'עוד 30 יום', 'לא משלם', '14 ימים', 'שמור הגדרות תזכורות']) assert.ok(html.includes(text));
});
