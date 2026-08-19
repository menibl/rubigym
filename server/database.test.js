import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveDatabaseSsl } from './database.js';

test('disables TLS for the Docker Compose PostgreSQL service', () => {
  assert.equal(resolveDatabaseSsl('postgresql://gymflow:secret@postgres:5432/gymflow'), false);
});

test('uses TLS by default for external PostgreSQL services', () => {
  assert.deepEqual(
    resolveDatabaseSsl('postgresql://gymflow:secret@database.example.com:5432/gymflow'),
    { rejectUnauthorized: false },
  );
});

test('honors explicit DATABASE_SSL overrides', () => {
  assert.equal(
    resolveDatabaseSsl('postgresql://gymflow:secret@database.example.com:5432/gymflow', 'false'),
    false,
  );
  assert.deepEqual(
    resolveDatabaseSsl('postgresql://gymflow:secret@postgres:5432/gymflow', 'require'),
    { rejectUnauthorized: false },
  );
});

test('rejects an invalid DATABASE_SSL value', () => {
  assert.throws(
    () => resolveDatabaseSsl('postgresql://gymflow:secret@postgres:5432/gymflow', 'sometimes'),
    /DATABASE_SSL/,
  );
});
