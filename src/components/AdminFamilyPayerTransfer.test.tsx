import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { AdminFamilyPayerTransfer } from './AdminFamilyPayerTransfer';
import type { User } from '../types';

const adi = { id: 'adi', name: 'עדי פנצ׳ר', role: 'TRAINEE', familyId: 'family', isFamilyPayer: true } as User;
const oren = { id: 'oren', name: 'אורן פנצ׳ר', role: 'TRAINEE', familyId: 'family', familyPayerId: 'adi' } as User;
test('manager transfer starts read-only with explicit candidate choice, protected card notice and no confirmation action yet', () => {
  const html = renderToStaticMarkup(<AdminFamilyPayerTransfer user={adi} users={[adi, oren, { ...oren, id: 'outside', name: 'מחוץ למשפחה', familyId: 'other' }]} onClose={() => {}} />);
  assert.match(html, /החלפת משלם משפחתי וחשבוניות/);
  assert.match(html, /בחירת בן משפחה/);
  assert.match(html, /אורן פנצ׳ר/);
  assert.doesNotMatch(html, /מחוץ למשפחה/);
  assert.match(html, /בדיקה ותצוגה מקדימה — ללא שינוי/);
  assert.doesNotMatch(html, /אישור העברת המשלם ושם החשבוניות/);
  assert.match(html, /לא משנים שם משתמש, סיסמה, כרטיס, סכום, יום חיוב, מסלול, יתרות או תוקף/);
  assert.match(html, /המשלם ההיסטורי נשמרים/);
});
test('confirmation explains new family-management permissions and status checks never re-confirm or create a charge', () => {
  const source = readFileSync(new URL('./AdminFamilyPayerTransfer.tsx', import.meta.url), 'utf8');
  assert.match(source, /window\.confirm/);
  assert.match(source, /הרשאות ניהול בני המשפחה/);
  assert.match(source, /מתבצעת בדיקה אוטומטית ברקע/);
  assert.match(source, /action, userId: user\.id/);
  assert.doesNotMatch(source, /GetUrl|SaleChargeToken|cancel-recurring|update-recurring/);
});
