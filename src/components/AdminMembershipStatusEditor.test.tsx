import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdminMembershipStatusEditor, updateMembershipStatusAndExpiry } from './AdminMembershipStatusEditor';
import { AdminTraineeEditor } from './AdminTraineeEditor';
import { MembershipStatus, MembershipType, UserRole, type User } from '../types';

const user = { id: 'test', name: 'מתאמנת לדוגמה', role: UserRole.TRAINEE, membershipType: MembershipType.OPEN_GYM,
  membershipStatus: MembershipStatus.EXPIRED, membershipExpiry: '2026-10-01', membershipExpiryExclusive: true,
  offlinePaymentApproved: true, personalTrainingRemaining: 6 } as User;

test('status and expiry have explicit labels in that order and one save action', () => {
  const html = renderToStaticMarkup(<AdminMembershipStatusEditor user={user} onSave={() => {}} />);
  assert.ok(html.indexOf('<select') < html.indexOf('type="date"'));
  assert.match(html, /aria-label="סטטוס המנוי של מתאמנת לדוגמה"/);
  assert.match(html, /aria-label="תוקף המנוי של מתאמנת לדוגמה"/);
  assert.match(html, /שמור סטטוס ותוקף/);
  assert.match(html, /value="2026-10-01"/);
});

test('saving active status and new expiry together preserves payment approval and credits', () => {
  const updated = updateMembershipStatusAndExpiry(user, MembershipStatus.ACTIVE, '2026-11-01');
  assert.equal(updated.membershipStatus, MembershipStatus.ACTIVE);
  assert.equal(updated.membershipExpiry, '2026-11-01');
  assert.equal(updated.membershipExpiryManualOverride, true);
  assert.equal(updated.membershipExpiryExclusive, true);
  assert.equal(updated.offlinePaymentApproved, true);
  assert.equal(updated.personalTrainingRemaining, 6);
  assert.equal(user.membershipExpiry, '2026-10-01');
});

test('status-only edits preserve existing expiry override semantics; dates may be cleared explicitly', () => {
  const updated = updateMembershipStatusAndExpiry({ ...user, membershipExpiryManualOverride: false }, MembershipStatus.DEBT, user.membershipExpiry!);
  assert.equal(updated.membershipExpiryManualOverride, false);
  assert.equal(updated.membershipExpiry, user.membershipExpiry);
  assert.equal(updateMembershipStatusAndExpiry(user, MembershipStatus.EXPIRED, '').membershipExpiry, undefined);
});

test('invalid or nonexistent dates are rejected, while past dates and leap days remain allowed', () => {
  for (const date of ['not-a-date', '2026-02-30', '2026-13-01', '2026-1-1']) {
    assert.throws(() => updateMembershipStatusAndExpiry(user, MembershipStatus.ACTIVE, date), /תאריך תוקף/);
  }
  assert.equal(updateMembershipStatusAndExpiry(user, MembershipStatus.EXPIRED, '2024-02-29').membershipExpiry, '2024-02-29');
});

test('active without an expiry shows a warning, rather than silently inventing a paid term', () => {
  const html = renderToStaticMarkup(<AdminMembershipStatusEditor user={{ ...user, membershipStatus: MembershipStatus.ACTIVE, membershipExpiry: undefined }} onSave={() => {}} />);
  assert.match(html, /ללא תאריך תוקף/);
});

test('profile editor no longer edits or submits a membership expiry date', () => {
  const html = renderToStaticMarkup(<AdminTraineeEditor user={user} users={[user]} onSave={() => {}} onClose={() => {}} />);
  assert.doesNotMatch(html, /value="2026-10-01"/);
  assert.match(html, /פעולות מסלול, תשלום ומחיקה/);
});
