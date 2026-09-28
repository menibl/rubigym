import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveSessionProgram } from './sessionProgram';
import type { TrainingSession, GroupWorkoutProgram, WorkoutPlan } from '../types';

test('legacy calendar-linked group plan remains visible even with a draft status', () => {
  const session = { id: 'booked-session' } as TrainingSession;
  const program = { id: 'linked', sessionId: session.id, status: 'DRAFT', libraryEntry: false } as GroupWorkoutProgram;
  assert.equal(resolveSessionProgram(session, [], [program]).group, program);
});

test('explicit assignment wins over legacy links and unrelated library entries', () => {
  const session = { id: 's', assignedGroupWorkoutProgramId: 'assigned' } as TrainingSession;
  const programs = [
    { id: 'legacy', sessionId: 's' },
    { id: 'assigned', libraryEntry: true },
  ] as GroupWorkoutProgram[];
  assert.equal(resolveSessionProgram(session, [], programs).group?.id, 'assigned');
  assert.equal(resolveSessionProgram({ id: 'other' } as TrainingSession, [], programs).group, undefined);
});

test('personal plans must belong to the calendar session, not just the same trainee', () => {
  const session = { id: 's', isPersonalTraining: true } as TrainingSession;
  const plans = [
    { id: 'unrelated', traineeId: 'trainee', exercises: [{}] },
    { id: 'linked', sessionId: 's', exercises: [{}] },
  ] as WorkoutPlan[];
  assert.equal(resolveSessionProgram(session, plans, []).personal?.id, 'linked');
});
