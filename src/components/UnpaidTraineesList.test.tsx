import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MembershipStatus, UserRole, type User, type MembershipPlanConfig } from '../types';
import { activeDebtTrainees, filterDebtTrainees } from '../data/unpaidTrainees';
import { UnpaidTraineesList } from './UnpaidTraineesList';

const trainee = (id: string, extra: Partial<User> = {}) => ({ id, name: id, role: UserRole.TRAINEE, membershipStatus: MembershipStatus.DEBT, ...extra } as User);

test('finance drill-down counts only debt trainees and does not change source records', () => {
  const users = [trainee('debt'), trainee('active', { membershipStatus: MembershipStatus.ACTIVE }), trainee('expired', { membershipStatus: MembershipStatus.EXPIRED }), trainee('manager', { role: UserRole.MANAGER })];
  const before = JSON.stringify(users);
  assert.deepEqual(activeDebtTrainees(users).map(user => user.id), ['debt']);
  assert.deepEqual(filterDebtTrainees(users, '').map(user => user.id), ['debt']);
  assert.equal(JSON.stringify(users), before);
});

test('search supports Hebrew names, email, international phone and family payer', () => {
  const users = [trainee('child', { name: 'נועם בללי', email: 'Noam@example.com', phone: '054-123-4567', familyPayerId: 'payer' }), trainee('payer', { name: 'מני בללי', membershipStatus: MembershipStatus.ACTIVE })];
  for (const query of [' נועם   בללי ', 'NOAM@EXAMPLE', '+972541234567', 'מני']) {
    assert.deepEqual(filterDebtTrainees(users, query).map(user => user.id), ['child']);
  }
  assert.equal(filterDebtTrainees(users, 'אין התאמה').length, 0);
});

test('list shows recorded plan, expiry and exceptions without inventing an amount due', () => {
  const users = [trainee('child', { name: 'נועם', membershipType: 'custom' as User['membershipType'], membershipExpiry: '2026-12-01', offlinePaymentApproved: true, familyPaymentPending: true })];
  const html = renderToStaticMarkup(<UnpaidTraineesList users={users} plans={[{ id: 'custom', label: 'המסלול שהוגדר במועדון' } as MembershipPlanConfig]} onClose={() => {}} onOpenUser={() => {}} />);
  for (const value of ['finance-unpaid-list', 'finance-unpaid-search', 'המסלול שהוגדר במועדון', '2026-12-01', 'אישור מנהל ידני', 'ממתין להשלמת תשלום', 'פתיחת פרטי המתאמן נועם', 'סימון חוב אינו הוכחה']) assert.ok(html.includes(value), value);
  assert.ok(!html.includes('₪'));
});

test('empty debt list has an explicit empty state and a close control', () => {
  const html = renderToStaticMarkup(<UnpaidTraineesList users={[]} plans={[]} onClose={() => {}} onOpenUser={() => {}} />);
  assert.match(html, /אין מתאמנים במצב חוב פעיל/);
  assert.match(html, /סגירת הרשימה/);
});
