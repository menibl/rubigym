import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdminBulkRecurringRecovery } from './AdminBulkRecurringRecovery';

test('bulk recovery starts read-only, explains pending versus paid and never exposes apply before verified preview', () => {
  const html = renderToStaticMarkup(<AdminBulkRecurringRecovery />);
  assert.match(html, /בדיקת הוראות היום — ללא שינוי/);
  assert.match(html, /אינה יוצרת קבלה פיקטיבית/);
  assert.match(html, /אין יצירת הוראה, חיוב או החזר/);
  assert.doesNotMatch(html, /אישור סנכרון ההתאמות המאומתות בלבד/);
});
