import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProgramCheckoutButton } from './ProgramCheckoutButton';

for (const kind of ['workout', 'nutrition'] as const) {
  test(`${kind} program CTA is price-free, accessible and points to checkout`, () => {
    const html = renderToStaticMarkup(<ProgramCheckoutButton kind={kind} onCheckout={() => {}} />);
    assert.match(html, /type="button"/);
    assert.match(html, /לתשלום עבור תוכנית/);
    assert.match(html, /min-h-11/);
    assert.doesNotMatch(html, /₪|ש״ח|150|350/);
  });
}

test('trainee offer pages contain no prices; catalog prices remain in membership checkout', () => {
  const source = readFileSync(new URL('./TraineeDashboard.tsx', import.meta.url), 'utf8');
  const checkout = source.indexOf("{activeTab === 'membership'");
  assert.ok(checkout > 0);
  assert.doesNotMatch(source.slice(0, checkout), /₪/);
  assert.match(source.slice(checkout), /planConfig\.price/);
  assert.match(source, /kind="workout" onCheckout=\{handlePayWorkoutPlan\}/);
  assert.match(source, /kind="nutrition" onCheckout=\{handlePayNutritionPlan\}/);
  assert.match(source, /setActiveTab\('membership'\);\s*openMembershipCheckout\(MembershipType\.WORKOUT_COACHING, 'ADDON'\)/);
  assert.match(source, /setActiveTab\('membership'\);\s*openMembershipCheckout\(MembershipType\.NUTRITION_COACHING, 'ADDON'\)/);
  assert.match(source, /id="membership-checkout" tabIndex=\{-1\}/);
  assert.match(source, /checkout\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(source, /checkout\?\.scrollIntoView\(\{ block: 'start' \}\)/);
});
