import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdminTraineeEditor } from './AdminTraineeEditor';
import type { User } from '../types';

test('manager sees separate full invoice name and editable login username without triggering requests', () => {
  const user = { id: 'u', name: 'עדי פנצר', username: 'adi-login', role: 'TRAINEE' } as User;
  let saved = false;
  const html = renderToStaticMarkup(<AdminTraineeEditor user={user} users={[user]} onSave={() => { saved = true; }} onClose={() => {}} />);
  assert.match(html, /שם מלא לחשבונית — פרטי ומשפחה/);
  assert.match(html, /שם משתמש לכניסה — ניתן לשינוי/);
  assert.match(html, /value="עדי פנצר"/);
  assert.match(html, /value="adi-login"/);
  assert.match(html, /שינויו אינו משנה סיסמה, תשלומים או מנויים/);
  assert.match(html, /הוראות קבע קיימות ברווחית אינם משתנים כאן/);
  assert.equal(saved, false);
});
