import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CoachExceptionArrivalPanel } from './CoachExceptionArrivalPanel';
import { ClubArrivalScanner } from './ClubArrivalScanner';
import { User, UserRole } from '../types';

test('coach panel includes QR approval and a separate explicitly confirmed historical correction, only trainees are selectable', () => {
  const users = [{ id: 't', name: 'מתאמן לבדיקה', role: UserRole.TRAINEE }, { id: 'c', name: 'מאמן לבדיקה', role: UserRole.COACH }] as User[];
  const html = renderToStaticMarkup(<CoachExceptionArrivalPanel users={users} />);
  assert.match(html, /אישור חריג/); assert.match(html, /10 דקות/);
  assert.match(html, /תיעוד אימון שכבר בוצע/);
  assert.match(html, /אני מאשר/); assert.match(html, /קרדיט אחד/);
  assert.match(html, /value="t"/); assert.doesNotMatch(html, /value="c"/);
  assert.match(html, /type="date"/); assert.match(html, /type="checkbox"/);
  assert.match(html, /disabled=""/);
});

test('regular trainee scanner remains available with the unchanged normal entry flow', () => {
  const html = renderToStaticMarkup(<ClubArrivalScanner logs={[]} />);
  assert.match(html, /סריקת קוד המועדון/);
  assert.match(html, /פתיחת מצלמה וסריקה/);
  assert.doesNotMatch(html, /תיעוד האימון וניכוי קרדיט אחד/);
});
