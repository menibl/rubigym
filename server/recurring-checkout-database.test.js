import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { createDatabaseStore } from './database.js';

test('SQL continuation storage is separate, club/order scoped and bound to its original user', async t => {
  const calls = [];
  let ownerMismatch = false;
  t.mock.method(pg.Pool.prototype, 'query', async (sql, values) => {
    calls.push({ sql, values });
    if (sql.startsWith('SELECT user_id,encrypted_checkout')) return { rows: [{ user_id: 'u', encrypted_checkout: 'fixture-ciphertext' }] };
    return { rows: [], rowCount: ownerMismatch ? 0 : 1 };
  });
  const store = await createDatabaseStore('postgres://localhost/test');
  assert.match(calls[0].sql, /CREATE TABLE IF NOT EXISTS recurring_checkout_continuations/);
  await store.saveRecurringContinuation('club', 'order', 'u', 'fixture-ciphertext');
  assert.deepEqual(calls.at(-1).values, ['club', 'order', 'u', 'fixture-ciphertext']);
  assert.match(calls.at(-1).sql, /WHERE recurring_checkout_continuations.user_id=EXCLUDED.user_id/);
  assert.deepEqual(await store.getRecurringContinuation('club', 'order'), { user_id: 'u', encrypted_checkout: 'fixture-ciphertext' });
  assert.deepEqual(calls.at(-1).values, ['club', 'order']);
  ownerMismatch = true;
  await assert.rejects(store.saveRecurringContinuation('club', 'order', 'other-user', 'different-ciphertext'), /OWNER_MISMATCH/);
  await store.close();
});
