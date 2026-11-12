import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdminMedicalCertificate } from './AdminMedicalCertificate';
import { HealthDeclarationForm } from './HealthDeclarationForm';
import { UserRole, type User, type HealthDeclarationRecord } from '../types';

const user = { id: 'test', role: UserRole.TRAINEE, name: 'מתאמן לבדיקה' } as User;
const record = { id: 'h', signed: true, signedAt: '2026-11-01', validUntil: '2027-11-01', requiresMedicalCertificate: true } as HealthDeclarationRecord;
test('manager sees separate upload, pending state and unchanged-signature notice', () => {
  const html = renderToStaticMarkup(<AdminMedicalCertificate user={user} record={record} />);
  assert.match(html, /העלאת אישור רופא/);
  assert.match(html, /ממתין לאישור מנהל/);
  assert.match(html, /אינה משנה תשובות, חתימה או תוקף/);
  assert.doesNotMatch(html, /אישור מנהל לאישור הרופא/);
});
test('existing document requires an explicit review checkbox before approval', () => {
  const html = renderToStaticMarkup(<AdminMedicalCertificate user={user} record={{ ...record, medicalCertificateDataUrl: 'data:application/pdf;base64,JVBERi0=', medicalCertificateFileName: 'test.pdf' }} />);
  assert.match(html, /בדקתי את האישור הרפואי/);
  assert.match(html, /<button[^>]*disabled=""[^>]*>אישור מנהל לאישור הרופא/);
  assert.match(html, /download="test.pdf"/);
});
test('health form still requires original declaration consent and labels every medical question', () => {
  const html = renderToStaticMarkup(<HealthDeclarationForm fullName="Test" age={17} onComplete={() => { throw Error('must not auto-submit'); }} />);
  assert.match(html, /הסכמה בכתב של אחד מהורי הקטין/);
  assert.match(html, /חתימתי הדיגיטלית/);
  assert.equal((html.match(/<fieldset/g) || []).length, 13);
});
