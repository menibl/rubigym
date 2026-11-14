import test from 'node:test';
import assert from 'node:assert/strict';
import { updateExerciseWorkingValues, preserveExerciseWorkingValues } from '../shared/exercise-working-values.js';
import { mergePayloadForUser } from './auth.js';
import worker from './index.js';

const seed = () => ({ users: [{ id: 't', role: 'TRAINEE', membershipType: 'OPEN_MONTHLY', membershipStatus: 'ACTIVE', membershipExpiry: '2099-01-01' }, { id: 'other', role: 'TRAINEE' }, { id: 'c', role: 'COACH' }, { id: 'm', role: 'MANAGER' }], workoutPlans: [{ id: 'p', traineeId: 't', exercises: [{ id: 'e', name: 'סקוואט', weight: '20kg', restDuration: '60 שניות', sets: 3 }] }] });
const input = (extra = {}) => ({ planId: 'p', exerciseId: 'e', weightKg: '22.5', restSeconds: '90', expectedRevision: 0, ...extra });

test('legacy plans stay blank; coach and trainee can set and clear working values without changing timer/prescription', () => {
  const state = seed();
  assert.equal(state.workoutPlans[0].exercises[0].workingValues, undefined);
  const next = updateExerciseWorkingValues(state, 't', input());
  const exercise = next.workoutPlans[0].exercises[0];
  assert.deepEqual(exercise.workingValues, { weightKg: '22.5', restSeconds: '90', revision: 1 });
  assert.equal(exercise.restDuration, '60 שניות'); assert.equal(exercise.weight, '20kg'); assert.equal(exercise.sets, 3);
  assert.equal(state.workoutPlans[0].exercises[0].workingValues, undefined);
  const cleared = updateExerciseWorkingValues(next, 'c', input({ expectedRevision: 1, weightKg: '', restSeconds: '' }));
  assert.equal(cleared.workoutPlans[0].exercises[0].workingValues.weightKg, '');
  assert.equal(updateExerciseWorkingValues(state, 'm', input({ weightKg: '0', restSeconds: '0' })).workoutPlans[0].exercises[0].workingValues.restSeconds, '0');
});

test('only own active assigned plan is editable; no family/library/session or missing exercise bypass', () => {
  const state = seed();
  for (const actor of ['other', 'unknown']) assert.throws(() => updateExerciseWorkingValues(state, actor, input()), error => error.status === 403);
  for (const change of [{ libraryEntry: true }, { sessionId: 's' }]) {
    const next = seed(); Object.assign(next.workoutPlans[0], change);
    assert.throws(() => updateExerciseWorkingValues(next, 't', input()), error => error.status === 403);
  }
  state.users[0].membershipExpiry = '2020-01-01';
  assert.throws(() => updateExerciseWorkingValues(state, 't', input()), error => error.status === 403);
  assert.throws(() => updateExerciseWorkingValues(seed(), 'c', input({ exerciseId: 'missing' })), error => error.status === 409);
});

test('validates limits and optimistic revision, never permits edits to prescription or another exercise', () => {
  for (const invalid of [{ weightKg: '-1' }, { weightKg: '1501' }, { weightKg: 'NaN' }, { weightKg: 10 }, { restSeconds: '1.5' }, { restSeconds: '3601' }, { restSeconds: null }]) {
    assert.throws(() => updateExerciseWorkingValues(seed(), 't', input(invalid)), error => error.status === 400);
  }
  const state = updateExerciseWorkingValues(seed(), 't', input());
  assert.throws(() => updateExerciseWorkingValues(state, 'c', input()), error => error.status === 409);
  const next = updateExerciseWorkingValues(seed(), 't', input({ sets: 999, name: 'forged' }));
  assert.equal(next.workoutPlans[0].exercises[0].sets, 3);
  assert.equal(next.workoutPlans[0].exercises[0].name, 'סקוואט');
});

test('generic stale staff saves preserve latest working values; copied plans/exercises start blank', () => {
  const current = updateExerciseWorkingValues(seed(), 't', input());
  for (const role of ['MANAGER', 'COACH', 'TRAINEE']) {
    const merged = mergePayloadForUser(current, seed(), role === 'TRAINEE' ? 't' : role === 'COACH' ? 'c' : 'm', role);
    assert.deepEqual(merged.workoutPlans[0].exercises[0].workingValues, current.workoutPlans[0].exercises[0].workingValues);
  }
  const copied = structuredClone(current); copied.workoutPlans[0].id = 'copy';
  assert.equal(preserveExerciseWorkingValues(current, copied).workoutPlans[0].exercises[0].workingValues, undefined);
});

function apiFixture({ conflict = false, authenticated = true } = {}) {
  let state = { revision: 1, payload: seed() }; let writes = 0;
  const store = { getSession: async () => authenticated ? { club_id: 'test', user_id: 't' } : null,
    getAccount: async () => ({ user_id: 't', role: 'TRAINEE' }), getClubState: async () => state,
    putClubState: async (_club, payload, revision) => { writes++; assert.equal(revision, state.revision);
      if (conflict && writes === 1) { state = { revision: revision + 1, payload: { ...state.payload, messages: [{ id: 'concurrent' }] } }; return { conflict: true }; }
      state = { revision: revision + 1, payload }; return { revision: state.revision }; }
  };
  return { state: () => state, post: body => worker.fetch(new Request('https://club.test/api/workouts/exercise-values', { method: 'POST', headers: { Cookie: 'baly_session=test', 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), { STATE_STORE: store, CLUB_ID: 'test' }) };
}
test('API requires authentication, persists narrowly and retries CAS preserving concurrent changes', async () => {
  assert.equal((await apiFixture({ authenticated: false }).post(input())).status, 401);
  const api = apiFixture({ conflict: true });
  const response = await api.post(input()); assert.equal(response.status, 200);
  assert.equal((await response.json()).workingValues.weightKg, '22.5');
  assert.equal(api.state().payload.messages[0].id, 'concurrent');
  assert.equal((await api.post(input())).status, 409);
});
