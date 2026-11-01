import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdminRecurringRequests } from './AdminRecurringRequests';

test('pending request controls explain unpaid status and hide release until the server authorizes it', () => {
  const html = renderToStaticMarkup(<AdminRecurringRequests userId="fixture-user" />);
  assert.match(html, /בקשת דף אינה אישור תשלום/);
  assert.match(html, /בדיקה לא פותחת דף חדש ולא מחייבת/);
  assert.match(html, /הצגת בקשות קיימות/);
  assert.doesNotMatch(html, /שחרור בקשה שלא נשלחה/);
  assert.doesNotMatch(html, /paymentReference|fixture-user/);
});
