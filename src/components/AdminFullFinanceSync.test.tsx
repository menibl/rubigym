import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { AdminFullFinanceSync } from './AdminFullFinanceSync';

test('full sync button explains no charge, all linked dates and partial review results, starts without fetching', () => {
  const html = renderToStaticMarkup(<AdminFullFinanceSync />);
  for (const text of ['סנכרון מלא מול רווחית — ללא חיוב', 'לא רק מהיום', 'ללא יצירת חיוב', 'עסקה חיצונית', 'חוסר תשובה אינו דחיית תשלום']) assert.ok(html.includes(text));
  assert.ok(!/<details[^>]*\sopen/.test(html));
});

test('full sync executes stored references sequentially, supports stop and refreshes authoritative totals', () => {
  const source = readFileSync(new URL('./AdminFullFinanceSync.tsx', import.meta.url), 'utf8');
  assert.match(source, /for \(const task of manifest.tasks\)/);
  assert.match(source, /action: 'sync', taskId: task.id/);
  assert.match(source, /if \(stop.current\) break/);
  assert.match(source, /running.current/);
  assert.match(source, /baly:refresh-billing/);
  assert.doesNotMatch(source, /\/create|\/GetUrl|\/Charge|\/Cancel|Promise.all/);
});
