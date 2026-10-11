import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { MembershipType, User } from '../types';
import { matchesBookingCategory, traineeBookingCategories } from '../data/traineeBookingFilter';
import { BookingCategoryPicker } from './BookingCategoryPicker';

const trainee = (membershipType: MembershipType, secondaryMemberships: MembershipType[] = []) => ({ membershipType, secondaryMemberships } as User);

for (const type of [MembershipType.GROUP_MONTHLY, MembershipType.GROUP_ANNUAL, MembershipType.CORE_GROUPS,
  MembershipType.YOUTH_ONCE_WEEKLY, MembershipType.YOUTH_TWICE_WEEKLY, MembershipType.DEDICATED_GROUP_HALF_YEAR]) {
  test(`${type} defaults to group only and offers included Open Gym separately`, () => {
    const categories = traineeBookingCategories(trainee(type));
    assert.equal(categories.primary, 'GROUP');
    assert.ok(categories.additional.includes('OPEN_GYM'));
    assert.equal(matchesBookingCategory('PRIMARY', categories.primary, 'GROUP'), true);
    assert.equal(matchesBookingCategory('PRIMARY', categories.primary, 'OPEN_GYM'), false);
    assert.equal(matchesBookingCategory('PRIMARY', categories.primary, 'PERSONAL'), false);
  });
}

test('Open Gym only does not offer group or personal additions', () => {
  assert.deepEqual(traineeBookingCategories(trainee(MembershipType.OPEN_GYM)), { primary: 'OPEN_GYM', additional: [] });
});

test('personal and duo share personal schedule, with Open Gym only when entitled', () => {
  for (const type of [MembershipType.PERSONAL_TRAINING, MembershipType.DUO_TRAINING]) {
    assert.deepEqual(traineeBookingCategories(trainee(type)), { primary: 'PERSONAL', additional: [] });
    assert.deepEqual(traineeBookingCategories(trainee(type, [MembershipType.OPEN_GYM])), { primary: 'PERSONAL', additional: ['OPEN_GYM'] });
    assert.equal(matchesBookingCategory('PRIMARY', 'PERSONAL', 'GROUP'), false);
  }
});

test('group with personal and duo has no duplicate category buttons', () => {
  const categories = traineeBookingCategories(trainee(MembershipType.GROUP_MONTHLY, [MembershipType.PERSONAL_TRAINING, MembershipType.DUO_TRAINING, MembershipType.OPEN_GYM]));
  assert.equal(categories.primary, 'GROUP');
  assert.deepEqual(new Set(categories.additional), new Set(['PERSONAL', 'OPEN_GYM']));
});

test('legacy Open Gym subscriptions and punch cards have an Open Gym default', () => {
  for (const type of [MembershipType.OPEN_ANNUAL, MembershipType.OPEN_MONTHLY, MembershipType.OPEN_PUNCH_CARD, MembershipType.OPEN_GYM_WITH_PLAN]) {
    assert.equal(traineeBookingCategories(trainee(type)).primary, 'OPEN_GYM');
  }
});

test('program-only primary falls back to a bookable secondary membership', () => {
  assert.equal(traineeBookingCategories(trainee(MembershipType.WORKOUT_PLAN, [MembershipType.OPEN_GYM])).primary, 'OPEN_GYM');
});

test('explicit category limits the list and all-club removes only category filtering', () => {
  for (const category of ['GROUP', 'PERSONAL', 'OPEN_GYM'] as const) {
    assert.equal(matchesBookingCategory('ALL', 'GROUP', category), true);
    assert.equal(matchesBookingCategory('OPEN_GYM', 'GROUP', category), category === 'OPEN_GYM');
  }
});

test('mobile-friendly controls expose additions on request and retain an all-club choice', () => {
  const props = { primary: 'GROUP' as const, additional: ['OPEN_GYM', 'PERSONAL'] as const,
    filter: 'PRIMARY' as const, allClub: false, onExpand: () => {}, onChoose: () => {} };
  const closed = renderToStaticMarkup(<BookingCategoryPicker {...props} additional={[...props.additional]} expanded={false} />);
  assert.match(closed, /הצג אימונים נוספים/);
  assert.match(closed, /הצג את כל אימוני המועדון/);
  assert.match(closed, /aria-expanded="false"/);
  assert.doesNotMatch(closed, /הצג Open Gym/);
  const open = renderToStaticMarkup(<BookingCategoryPicker {...props} additional={[...props.additional]} expanded />);
  assert.match(open, /הצג Open Gym/);
  assert.match(open, /הצג אישיים \/ זוגיים/);
  assert.match(open, /כל האימונים במסלולים שלי/);
});

test('all-club view warns that showing a session does not grant booking permission', () => {
  const html = renderToStaticMarkup(<BookingCategoryPicker primary="OPEN_GYM" additional={[]} filter="ALL" allClub expanded={false} onExpand={() => {}} onChoose={() => {}} />);
  assert.match(html, /ההרשמה עדיין כפופה למסלול/);
  assert.doesNotMatch(html, /הצג אימונים נוספים/);
});
