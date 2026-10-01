import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RoleWorkspaceLanding } from './RoleWorkspaceLanding';
import { MembershipType, UserRole, type User, type OpenGymSession, type TrainingSession } from '../types';

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
