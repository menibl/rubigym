import test from 'node:test';
import assert from 'node:assert/strict';
import { hasIncludedOpenGymAccess } from '../shared/open-gym-access.js';

test('all group plans include Open Gym regardless of their billing period', () => {
  for (const type of ['CORE_GROUPS', 'GROUP_MONTHLY', 'GROUP_ANNUAL',
    'YOUTH_ONCE_WEEKLY', 'YOUTH_TWICE_WEEKLY', 'DEDICATED_GROUP_HALF_YEAR',
    'WEIGHT_LOSS_HALF_YEAR', 'POSTPARTUM_HALF_YEAR']) {
    assert.equal(hasIncludedOpenGymAccess([type]), true, type);
  }
});

test('group secondary membership takes precedence over an Open Gym punch card', () => {
  assert.equal(hasIncludedOpenGymAccess(['OPEN_PUNCH_CARD', 'YOUTH_ONCE_WEEKLY']), true);
  assert.equal(hasIncludedOpenGymAccess(['OPEN_PUNCH_CARD', 'GROUP_MONTHLY']), true);
  assert.equal(hasIncludedOpenGymAccess(['OPEN_PUNCH_CARD']), false);
});

test('existing included Open Gym plans retain access', () => {
  for (const type of ['OPEN_GYM', 'OPEN_GYM_WITH_PLAN', 'OPEN_MONTHLY', 'OPEN_ANNUAL', 'FAMILY_MEMBERSHIP']) {
    assert.equal(hasIncludedOpenGymAccess([type]), true, type);
  }
});

test('unrelated purchases and missing memberships do not include Open Gym', () => {
  for (const type of ['PERSONAL_TRAINING', 'DUO_TRAINING', 'NUTRITION_COACHING',
    'NUTRITION_PLAN', 'WORKOUT_COACHING', 'WORKOUT_PLAN', 'unknown', undefined, null]) {
    assert.equal(hasIncludedOpenGymAccess([type]), false, String(type));
  }
  assert.equal(hasIncludedOpenGymAccess([]), false);
});
