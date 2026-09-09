import test from 'node:test';
import assert from 'node:assert/strict';
import {appendUserChangeMessages} from './user-change-messages.js';

const manager = {id: 'manager', name: 'רובי', role: 'MANAGER'};
const coach = {id: 'coach', name: 'מאמן', role: 'COACH'};
const timestamp = new Date('2026-08-28T08:00:00.000Z');

test('adds a chat message for every staff member when a trainee registers', () => {
  const trainee = {id: 'trainee', name: 'מני', role: 'TRAINEE', membershipType: 'OPEN_GYM'};
  const result = appendUserChangeMessages({users: [manager, coach], messages: []}, {users: [manager, coach, trainee], messages: []}, timestamp);
  assert.equal(result.messages.length, 2);
  assert.deepEqual(new Set(result.messages.map(message => message.receiverId)), new Set(['manager', 'coach']));
  assert.ok(result.messages.every(message => message.senderId === trainee.id && message.systemGenerated));
  assert.match(result.messages[0].content, /הצטרף\/ה למועדון/);
});

test('summarizes membership and capability changes in the trainee chat', () => {
  const beforeTrainee = {id: 'trainee', name: 'מני', role: 'TRAINEE', membershipType: 'OPEN_GYM', secondaryMemberships: [], nutritionPlanPaid: false};
  const afterTrainee = {...beforeTrainee, membershipType: 'GROUP_ANNUAL', secondaryMemberships: ['NUTRITION_PLAN'], nutritionPlanPaid: true};
  const result = appendUserChangeMessages({users: [manager, coach, beforeTrainee], messages: []}, {users: [manager, coach, afterTrainee], messages: []}, timestamp);
  assert.equal(result.messages.length, 2);
  assert.match(result.messages[0].content, /המסלול השתנה/);
  assert.match(result.messages[0].content, /שירותים ותוכניות עודכנו/);
});

test('does not create chat noise when trainee details did not change', () => {
  const trainee = {id: 'trainee', name: 'מני', role: 'TRAINEE', membershipType: 'OPEN_GYM'};
  const result = appendUserChangeMessages({users: [manager, coach, trainee], messages: []}, {users: [manager, coach, {...trainee}], messages: []}, timestamp);
  assert.equal(result.messages.length, 0);
});

test('does not treat reordered health questionnaire keys as a new declaration', () => {
  const trainee = {
    id: 'trainee', name: 'מני', role: 'TRAINEE', membershipType: 'OPEN_GYM',
    healthDeclarationAnswers: { heart_disease: 'NO', chest_pain_rest: 'NO' }
  };
  const reordered = {
    ...trainee,
    healthDeclarationAnswers: { chest_pain_rest: 'NO', heart_disease: 'NO' }
  };
  const result = appendUserChangeMessages(
    { users: [manager, trainee], messages: [] },
    { users: [manager, reordered], messages: [] },
    timestamp
  );
  assert.equal(result.messages.length, 0);
});

test('suppresses a repeated identical system alert during the autosave window', () => {
  const beforeTrainee = { id: 'trainee', name: 'מני', role: 'TRAINEE', healthDeclarationSigned: false };
  const afterTrainee = { ...beforeTrainee, healthDeclarationSigned: true };
  const first = appendUserChangeMessages(
    { users: [manager, beforeTrainee], messages: [] },
    { users: [manager, afterTrainee], messages: [] },
    timestamp
  );
  const repeated = appendUserChangeMessages(
    { users: [manager, beforeTrainee], messages: first.messages },
    { users: [manager, afterTrainee], messages: first.messages },
    new Date(timestamp.getTime() + 1_000)
  );
  assert.equal(repeated.messages.length, 1);
  assert.equal(repeated.messages[0].id, first.messages[0].id);
});

test('allows the same kind of genuine alert again after the deduplication window', () => {
  const beforeTrainee = { id: 'trainee', name: 'מני', role: 'TRAINEE', healthDeclarationSigned: false };
  const afterTrainee = { ...beforeTrainee, healthDeclarationSigned: true };
  const first = appendUserChangeMessages(
    { users: [manager, beforeTrainee], messages: [] },
    { users: [manager, afterTrainee], messages: [] },
    timestamp
  );
  const later = appendUserChangeMessages(
    { users: [manager, beforeTrainee], messages: first.messages },
    { users: [manager, afterTrainee], messages: first.messages },
    new Date(timestamp.getTime() + 11 * 60 * 1_000)
  );
  assert.equal(later.messages.length, 2);
});

test('reports cancellation and professional profile changes', () => {
  const trainee = {id: 'trainee', name: 'מני', role: 'TRAINEE', membershipType: 'GROUP_ANNUAL'};
  const result = appendUserChangeMessages({
    users: [manager, trainee], messages: [],
    traineeProfiles: [{traineeId: trainee.id, primaryGoal: 'כוח'}]
  }, {
    users: [manager, {...trainee, cancellationRequestedAt: '2026-08-28', cancellationEffectiveDate: '2026-09-28'}], messages: [],
    traineeProfiles: [{traineeId: trainee.id, primaryGoal: 'ירידה במשקל'}]
  }, timestamp);
  assert.equal(result.messages.length, 1);
  assert.match(result.messages[0].content, /ביטול עודכנו/);
  assert.match(result.messages[0].content, /המטרות או המגבלות עודכנו/);
});
