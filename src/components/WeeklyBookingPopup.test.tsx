import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import test from 'node:test';
import assert from 'node:assert/strict';
import { WeeklyBookingPopup } from './WeeklyBookingPopup';
import { TrainingSession } from '../types';
test('popup has labelled dialog, close controls, date/time and accessible registration action', () => {
  const html = renderToStaticMarkup(<WeeklyBookingPopup sessions={[{ id: 's', title: 'בנים', date: '2026-10-12', time: '19:00', registeredUsers: [], maxParticipants: 12 } as TrainingSession]} onClose={() => {}} onRegister={() => {}} />);
  assert.match(html, /role="dialog" aria-modal="true"/);
  assert.match(html, /סגירת חלון האימונים/);
  assert.match(html, /סגירה והמשך לאפליקציה/);
  assert.match(html, /הרשמה לבנים בתאריך 2026-10-12 בשעה 19:00/);
  assert.match(html, /max-h-\[85dvh\]/);
});
