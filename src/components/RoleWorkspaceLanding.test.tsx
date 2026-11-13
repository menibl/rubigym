import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RoleWorkspaceLanding } from './RoleWorkspaceLanding';
import { Gender, MembershipType, UserRole, type User, type OpenGymSession, type TrainingSession, type Announcement } from '../types';

const trainee = { id: 'trainee', name: 'Test', role: UserRole.TRAINEE, membershipType: MembershipType.OPEN_GYM } as User;
const openGym = { id: 'open', date: '2099-10-02', timeSlot: '10:15-11:00', registeredUsers: ['trainee'], maxParticipants: 10 } as OpenGymSession;
const render = (user: User, openGymSessions: OpenGymSession[], sessions: TrainingSession[] = []) => renderToStaticMarkup(
  <RoleWorkspaceLanding activeUser={user} openGymSessions={openGymSessions} sessions={sessions} onSelect={() => {}} onOpenProfile={() => {}} />
);

test('actual home tiles show an Open Gym-only member next booking', () => {
  const html = render(trainee, [openGym]);
  assert.match(html, /Open Gym · אימון חופשי/);
  assert.match(html, /10:15-11:00/);
  assert.doesNotMatch(html, /אין כרגע אימון משובץ/);
});

test('home changes when an Open Gym registration is added or cancelled', () => {
  assert.match(render(trainee, []), /אין כרגע אימון משובץ/);
  assert.match(render(trainee, [openGym]), /Open Gym · אימון חופשי/);
  assert.match(render(trainee, [{ ...openGym, registeredUsers: [] }]), /אין כרגע אימון משובץ/);
});

test('coach home does not show a trainee Open Gym booking as a coaching assignment', () => {
  assert.match(render({ ...trainee, role: UserRole.COACH }, [openGym]), /אין כרגע אימון משובץ/);
});

test('expired trainee home prominently offers direct renewal; current memberships and staff do not', () => {
  const expired = { ...trainee, membershipStatus: 'ACTIVE', membershipExpiry: '2020-01-01', membershipExpiryExclusive: true } as User;
  assert.match(render(expired, []), /aria-label="המנוי פג תוקף"/);
  assert.match(render(expired, []), /חידוש מנוי — בחירת מסלול ותשלום/);
  assert.doesNotMatch(render({ ...expired, membershipExpiry: '2099-01-01' }, []), /aria-label="המנוי פג תוקף"/);
  assert.doesNotMatch(render({ ...expired, role: UserRole.COACH }, []), /aria-label="המנוי פג תוקף"/);
});

test('membership tile contains every assigned plan and personal/duo balances on home', () => {
  const html = render({ ...trainee, membershipStatus: 'ACTIVE', membershipExpiry: '2099-11-01', secondaryMemberships: [MembershipType.PERSONAL_TRAINING, MembershipType.DUO_TRAINING], personalTrainingRemaining: 5, personalTrainingCardSize: 10, duoTrainingRemaining: 2, duoTrainingCardSize: 3 } as User, []);
  assert.match(html, /המנוי והתשלומים שלי/);
  assert.match(html, /סיכום המנויים, התשלומים ויתרות האימונים/);
  assert.match(html, /1\/11\/2099/);
  assert.match(html, /5\/10/); assert.match(html, /2\/3/);
  assert.match(html, /תוקף לא תועד/);
});

test('membership summary is not displayed on staff home', () => {
  assert.doesNotMatch(render({ ...trainee, role: UserRole.COACH }, []), /סיכום המנויים, התשלומים ויתרות האימונים/);
});

test('group home provides previous and upcoming mobile program buttons without requiring attendance registration', () => {
  const groupUser = { ...trainee, membershipType: MembershipType.GROUP_MONTHLY, gender: Gender.MALE, age: 30 };
  const group = (id: string, date: string) => ({ id, date, time: '19:00', title: 'קבוצת בנים', genderRestriction: Gender.MALE, allowedMemberships: [MembershipType.CORE_GROUPS], registeredUsers: [] } as TrainingSession);
  const html = renderToStaticMarkup(<RoleWorkspaceLanding activeUser={groupUser} sessions={[group('previous', '2020-01-01'), group('next', '2099-01-01')]} openGymSessions={[]} availableGroupSessionIds={['previous']} onOpenSessionProgram={() => {}} onSelect={() => {}} onOpenProfile={() => {}} />);
  assert.match(html, /תוכנית האימון הקודמת של הקבוצה/);
  assert.match(html, /עדיין לא שובצה תוכנית/);
  assert.match(html, /2020-01-01/); assert.match(html, /2099-01-01/);
});

test('home separates next booking from nearest eligible group program', () => {
  const groupUser = { ...trainee, membershipType: MembershipType.GROUP_MONTHLY, gender: Gender.FEMALE, age: 55 };
  const group = (id: string, date: string, registeredUsers: string[]) => ({ id, date, time: '18:00', title: id === 'near' ? 'הקבוצה הקרובה' : 'הקבוצה שהוזמנה', genderRestriction: Gender.FEMALE, allowedMemberships: [MembershipType.CORE_GROUPS], registeredUsers } as TrainingSession);
  const html = renderToStaticMarkup(<RoleWorkspaceLanding activeUser={groupUser} sessions={[group('near', '2099-01-01', []), group('booked', '2099-01-02', ['trainee'])]} openGymSessions={[]} availableGroupSessionIds={['near']} onOpenSessionProgram={() => {}} onSelect={() => {}} onOpenProfile={() => {}} />);
  assert.match(html, /הקבוצה שהוזמנה · 2099-01-02/);
  assert.match(html, /תוכנית האימון הקרוב של הקבוצה/);
  assert.match(html, /הקבוצה הקרובה · 2099-01-01/);
  assert.doesNotMatch(html, /עדיין לא שובצה תוכנית/);
});

test('actual app home renders matching club announcements before greeting and actions', () => {
  const announcements = [{ id: 'ann', title: 'עדכון חשוב למועדון', content: 'פרטי העדכון', createdBy: 'Manager', creatorRole: UserRole.MANAGER,
    date: '2026-11-13', targetGender: Gender.ALL, targetMembershipTypes: [MembershipType.OPEN_GYM] }] as Announcement[];
  const user = { ...trainee, membershipType: MembershipType.WORKOUT_COACHING, secondaryMemberships: [MembershipType.OPEN_GYM] };
  const html = renderToStaticMarkup(<RoleWorkspaceLanding activeUser={user} openGymSessions={[]} announcements={announcements} onSelect={() => {}} onOpenProfile={() => {}} />);
  assert.ok(html.indexOf('עדכון חשוב למועדון') < html.indexOf('שלום Test'));
  assert.ok(html.indexOf('עדכון חשוב למועדון') < html.indexOf('סריקת ברקוד לכניסה'));
  assert.equal((html.match(/עדכון חשוב למועדון/g) || []).length, 1);
  assert.match(html, /כל ההודעות \(1\)/);
});

test('actual manager home offers unchecked SMS option but coach home cannot enable it', () => {
  const html = render({ ...trainee, role: UserRole.MANAGER }, []);
  assert.match(html, /שלח הודעה זאת גם ב־SMS/);
  assert.doesNotMatch(html, /type="checkbox"[^>]*checked/);
  assert.doesNotMatch(render({ ...trainee, role: UserRole.COACH }, []), /שלח הודעה זאת גם ב־SMS/);
});
