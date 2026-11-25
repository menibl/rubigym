import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveCalendarSelection } from './calendarSelection';
import type { OpenGymSession, TrainingSession } from '../types';

const gym = (overrides = {}) => ({ id: 'series-2026-11-27', date: '2026-11-27', timeSlot: '07:00-08:00', registeredUsers: [], waitlistUsers: [], maxParticipants: 15, ...overrides }) as OpenGymSession;

test('open calendar details use fresh registrations and waitlist without reopening', () => {
  const original = gym();
  const selected = { type: 'OPEN_GYM' as const, openGym: original };
  const fresh = gym({ registeredUsers: ['tal', 'haviva'], waitlistUsers: ['waiting'] });
  const result = resolveCalendarSelection(selected, { sessions: [], openGym: [fresh] });
  assert.equal(result?.openGym, fresh);
  assert.deepEqual(result?.openGym?.registeredUsers, ['tal', 'haviva']);
  assert.deepEqual(original.registeredUsers, []);
  assert.deepEqual(resolveCalendarSelection(selected, { sessions: [], openGym: [gym()] })?.openGym?.registeredUsers, []);
});

test('deleted occurrences close details and another date or slot never substitutes', () => {
  const selected = { type: 'OPEN_GYM' as const, openGym: gym() };
  for (const openGym of [[], [gym({ date: '2026-12-04' })], [gym({ id: 'different-series' })]])
    assert.equal(resolveCalendarSelection(selected, { sessions: [], openGym }), null);
});

test('regular sessions also resolve the latest data and empty selection stays closed', () => {
  const session = { id: 'group', date: '2026-11-27', registeredUsers: [] } as unknown as TrainingSession;
  const fresh = { ...session, registeredUsers: ['new'] };
  assert.equal(resolveCalendarSelection({ type: 'SESSION', session }, { sessions: [fresh], openGym: [] })?.session, fresh);
  assert.equal(resolveCalendarSelection(null, { sessions: [fresh], openGym: [] }), null);
});

test('calendar derives details from current date expansion on every render', () => {
  const source = readFileSync(new URL('../components/WeeklyCalendar.tsx', import.meta.url), 'utf8');
  assert.match(source, /const selectedItem = resolveCalendarSelection\(selectedOccurrence,/);
  assert.match(source, /selectedDate \? getItemsForDate\(selectedDate\)/);
  assert.doesNotMatch(source, /const \[selectedItem, setSelectedItem\]/);
});
