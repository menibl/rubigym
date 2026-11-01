import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdminStuckCheckoutRelease } from './AdminStuckCheckoutRelease';

test('release UI requires provider investigation, starts read-only and never offers immediate reset', () => {
  const html = renderToStaticMarkup(<AdminStuckCheckoutRelease userId="fixture" orderId="old" onReleased={() => {}} />);
  assert.match(html, /בדיקה מקדימה לשחרור — ללא שינוי/);
  assert.match(html, /אינה מבטלת הוראות או דפים ברווחית/);
  assert.doesNotMatch(html, /אישור שחרור הבקשה — ללא חיוב חדש/);
  assert.doesNotMatch(html, /type="password"/);
});
