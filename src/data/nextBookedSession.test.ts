import test from 'node:test';
import assert from 'node:assert/strict';
import { nextBookedSession } from './nextBookedSession';
import type { TrainingSession, OpenGymSession } from '../types';

const now = new Date('2026-10-01T09:00:00');
const session = (time: string, registeredUsers = ['u']) => ({ id: 'group', date: '2026-10-01', time, registeredUsers, coachName: 'מאמן', maxParticipants: 12 }) as TrainingSession;
const open = (timeSlot: string, registeredUsers = ['u']) => ({ id: 'open', date: '2026-10-01', timeSlot, registeredUsers, waitlistUsers: ['waiting'], maxParticipants: 7 }) as OpenGymSession;

test('Open Gym alone appears with its actual time range and capacity', () => {
  const next = nextBookedSession('u', [], [open('10:15 - 11:00')], now);
  assert.equal(next?.kind, 'OPEN_GYM');
  assert.equal(next?.time, '10:15 - 11:00');
  assert.equal(next?.maxParticipants, 7);
  assert.equal(next?.coachName, '');
});
test('earliest registration wins across both collections regardless of input order', () => {
  assert.equal(nextBookedSession('u', [session('12:00')], [open('10:00-11:00')], now)?.id, 'open');
  assert.equal(nextBookedSession('u', [session('09:30')], [open('10:00-11:00')], now)?.id, 'group');
});
test('past sessions, invalid times and waiting lists do not become next workout', () => {
  assert.equal(nextBookedSession('u', [session('08:00')], [open('08:00-10:00'), open('invalid')], now), undefined);
  assert.equal(nextBookedSession('waiting', [], [open('10:00-11:00')], now), undefined);
  assert.equal(nextBookedSession('u', [], [open('10:00-11:00', ['someone-else'])], now), undefined);
});
test('dates are sorted together and an exact start time remains eligible', () => {
  assert.equal(nextBookedSession('u', [session('09:00')], [], now)?.id, 'group');
  const tomorrow = { ...session('06:00'), date: '2026-10-02' };
  assert.equal(nextBookedSession('u', [tomorrow], [open('22:00-23:00')], now)?.id, 'open');
});
test('no registrations leaves the card empty', () => {
  assert.equal(nextBookedSession('u', [], [], now), undefined);
});
