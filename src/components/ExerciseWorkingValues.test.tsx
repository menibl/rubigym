import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ExerciseWorkingValues } from './ExerciseWorkingValues';
import { type Exercise } from '../types';

const exercise = { id: 'e', name: 'לחיצת חזה', sets: 3, reps: '12', weight: '20kg', restDuration: '60 שניות' } as Exercise;
test('legacy exercise inputs are blank, labeled with units and do not inherit prescribed defaults', () => {
  const html = renderToStaticMarkup(<ExerciseWorkingValues planId="p" exercise={exercise} />);
  assert.match(html, /משקל עבודה \(ק״ג\)/); assert.match(html, /זמן מנוחה \(שניות\)/);
  assert.equal((html.match(/value=""/g) || []).length, 2);
  assert.ok(!html.includes('20kg')); assert.ok(!html.includes('60 שניות'));
  assert.match(html, /הערכים אינם משנים את טיימר האימון/);
  assert.match(html, /שמירת משקל ומנוחה לתרגיל לחיצת חזה/);
  assert.equal((html.match(/<label for=/g) || []).length, 2);
});
test('saved working values are displayed including zero, independent of prescription', () => {
  const html = renderToStaticMarkup(<ExerciseWorkingValues planId="p" exercise={{ ...exercise, workingValues: { weightKg: '22.5', restSeconds: '0', revision: 1 } }} />);
  assert.match(html, /value="22.5"/); assert.match(html, /value="0"/);
});
