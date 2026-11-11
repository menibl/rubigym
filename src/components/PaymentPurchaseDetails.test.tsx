import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PaymentPurchaseDetails } from './PaymentPurchaseDetails';
import { MembershipType, type Payment } from '../types';
const base = { id: 'receipt', traineeName: 'Anna', membershipTypePurchased: MembershipType.FAMILY_MEMBERSHIP, amount: 2250, status: 'PAID', discountCode: null } as Payment;
const render = (patch: Partial<Payment> = {}) => renderToStaticMarkup(<PaymentPurchaseDetails payment={{ ...base, ...patch }} />);

test('old family receipt displays recorded personal and duo purchase quantities without inventing prices', () => {
  const html = render({ familyMemberPlans: [{ memberId: 'a', memberName: 'Anna', membershipType: MembershipType.PERSONAL_TRAINING,
    trainingSessionsCount: 6, additionalPlans: [{ membershipType: MembershipType.DUO_TRAINING, trainingSessionsCount: 3 }] }] });
  assert.match(html, /כמות אימונים שנרכשה: 6/); assert.match(html, /כמות אימונים שנרכשה: 3/);
  assert.match(html, /מחיר ליחידה לפני הנחה: לא תועד/);
  assert.match(html, /₪2,250/); assert.match(html, /ללא קוד/);
  assert.match(html, /פירוט היסטורי חלקי/);
});

test('recorded snapshot displays unit prices, line discounts, totals and code', () => {
  const html = render({ amount: 180, discountCode: 'SAVE10', purchaseBreakdown: { version: 1, total: 180, subtotal: 200,
    discountAmount: 20, creditAmount: 0, lines: [{ membershipType: 'PERSONAL_TRAINING', quantity: 2, unitPrice: 100, baseAmount: 200, discountAmount: 20, netAmount: 180 }] } });
  assert.match(html, /מחיר ליחידה לפני הנחה: ₪100/); assert.match(html, /הנחה בשורה: ₪20/);
  assert.match(html, /SAVE10/); assert.match(html, /סכום שורה לאחר הנחה: ₪180/);
  assert.doesNotMatch(html, /נדרשת בדיקה/);
});

test('legacy missing counts and discount are unknown, not zero or current balances', () => {
  const html = render({ membershipTypePurchased: MembershipType.DUO_TRAINING, discountCode: undefined });
  assert.match(html, /כמות אימונים שנרכשה: לא תועדה/); assert.match(html, /קוד הנחה: לא תועד/);
  assert.match(html, /סך הנחה: לא תועד/);
});

test('mismatched snapshot, refunded/test and pending records cannot look like a reconciled paid breakdown', () => {
  const html = render({ status: 'REFUNDED', isMock: true, purchaseBreakdown: { version: 1, total: 5, lines: [] } });
  assert.match(html, /אינו תואם/); assert.match(html, /עסקה שהוחזרה/); assert.match(html, /עסקת בדיקה/);
  assert.match(render({ status: 'PENDING' }), /אינו תשלום שהושלם/);
});
