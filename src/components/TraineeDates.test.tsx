import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { TraineeDates } from './TraineeDates';

const render = (user: React.ComponentProps<typeof TraineeDates>['user'], now = new Date('2026-11-09T12:00:00Z')) =>
  renderToStaticMarkup(<TraineeDates user={user} now={now} />);

test('shows the earliest recorded registration and the annual declaration expiry underneath', () => {
  const html = render({ registrationVerifiedAt: '2026-10-02T10:00:00Z', registrationCompletedAt: '2026-10-04T10:00:00Z',
    healthDeclarationSigned: true, healthDeclarationDate: '2026-10-04' });
  assert.match(html, /dateTime="2026-10-02T10:00:00.000Z"/);
  assert.match(html, /dateTime="2027-10-04T00:00:00.000Z"/);
  assert.ok(html.indexOf('תאריך הצטרפות') < html.indexOf('תוקף הצהרת בריאות:'));
  assert.doesNotMatch(html, /פג תוקף/);
});

test('missing and malformed dates are explicit; unsigned declarations do not appear valid', () => {
  assert.match(render({}), /לא תועד/);
  assert.match(render({}), /לא נחתמה/);
  const html = render({ registrationCompletedAt: '2026-02-30', healthDeclarationSigned: true, healthDeclarationDate: 'bad' });
  assert.match(html, /לא תועד/); assert.match(html, /תאריך חתימה חסר או לא תקין/);
  assert.doesNotMatch(html, /<time/);
  assert.match(render({ healthDeclarationSigned: false, healthDeclarationDate: '2026-11-01' }), /לא נחתמה/);
});

test('completed registration is used without verification and timestamps display in Jerusalem time', () => {
  const html = render({ registrationCompletedAt: '2026-11-08T23:30:00Z' });
  assert.match(html, /9\.11\.2026/);
});

test('expired and pending-medical declarations have explicit textual statuses', () => {
  const html = render({ healthDeclarationSigned: true, healthDeclarationDate: '2025-11-01',
    healthDeclarationRequiresMedicalCertificate: true, healthDeclarationMedicalCertificateApproved: false });
  assert.match(html, /פג תוקף, נדרש חידוש/); assert.match(html, /ממתין לאישור רפואי/);
  assert.match(html, /text-rose-300/);
});

test('leap-day annual expiry follows the existing server rollover rule, not a fixed 365 days', () => {
  assert.match(render({ healthDeclarationSigned: true, healthDeclarationDate: '2024-02-29' }), /2025-03-01T00:00:00.000Z/);
});

test('date summary is mounted in each trainee personal-details cell', () => {
  const source = readFileSync(new URL('./AdminDashboard.tsx', import.meta.url), 'utf8');
  assert.match(source, /data-label="פרטים אישיים"[\s\S]*?<TraineeDates user=\{u\} \/>/);
});
