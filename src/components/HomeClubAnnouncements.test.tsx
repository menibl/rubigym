import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HomeClubAnnouncements } from './HomeClubAnnouncements';
import { WorkoutMembershipRequired } from './WorkoutMembershipRequired';
import { Gender, UserRole, type Announcement } from '../types';
const announcement = (id: string, date: string): Announcement => ({ id, date, title: id, content: 'פרטי הודעה', createdBy: 'מנהל', creatorRole: UserRole.MANAGER, targetGender: Gender.ALL });
test('home notices show newest first with a show-all action and no invented empty messages', () => {
  const html = renderToStaticMarkup(<HomeClubAnnouncements announcements={[announcement('old', '2026-11-01'), announcement('new', '2026-11-13')]} onShowAll={() => {}} />);
  assert.ok(html.indexOf('<h4>new</h4>') < html.indexOf('<h4>old</h4>'));
  assert.match(html, /כל ההודעות \(2\)/);
  assert.equal(renderToStaticMarkup(<HomeClubAnnouncements announcements={[]} onShowAll={() => {}} />), '');
});
test('workout gate explains required gym membership, preserves purchased program and links to checkout', () => {
  const html = renderToStaticMarkup(<WorkoutMembershipRequired onCheckout={() => {}} />);
  assert.match(html, /נדרש מנוי כניסה בתוקף/); assert.match(html, /מנוי קבוצתי הכולל Open Gym/);
  assert.match(html, /אין צורך לרכוש אותה שוב/); assert.match(html, /לבחירת מנוי ותשלום/);
});
test('expanded notices show all older messages and a collapse action', () => {
  const notices = Array.from({ length: 5 }, (_, index) => announcement(`notice-${index}`, '2026-11-13'));
  const html = renderToStaticMarkup(<HomeClubAnnouncements announcements={notices} expanded onShowAll={() => {}} />);
  assert.equal((html.match(/<article/g) || []).length, 5);
  assert.match(html, /הצג פחות/);
});
