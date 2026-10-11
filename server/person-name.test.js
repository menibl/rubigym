import test from 'node:test';
import assert from 'node:assert/strict';
import { splitPersonName, hasFullPersonName } from '../shared/person-name.js';
import worker from './index.js';

test('names support Hebrew, compound surnames, whitespace and real foreign surnames', () => {
  assert.deepEqual(splitPersonName('  מני\tבללי  '), { firstName: 'מני', lastName: 'בללי' });
  assert.deepEqual(splitPersonName('אנה איזביצקי כהן'), { firstName: 'אנה', lastName: 'איזביצקי כהן' });
  assert.equal(hasFullPersonName('Jean-Luc Van der Meer'), true);
  assert.equal(hasFullPersonName('רובי באלי'), true);
  assert.equal(hasFullPersonName('John BALY'), true); // Real supplied names are not rewritten.
});

test('missing surname stays empty and cannot complete registration', () => {
  assert.deepEqual(splitPersonName('מני'), { firstName: 'מני', lastName: '' });
  for (const name of ['', '   ', 'מני', 'מני 123', '123 בללי']) assert.equal(hasFullPersonName(name), false);
});

test('registration rejects missing surname on the server before saving anything', async () => {
  let writes = 0;
  const env = { STATE_STORE: { async putClubState() { writes++; } } };
  for (const name of ['מני', '   ', 'מני 123']) {
    const response = await worker.fetch(new Request('https://club.test/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: { id: 'u', role: 'TRAINEE', name, password: 'password-for-test', email: 'user@example.com' } })
    }), env);
    assert.equal(response.status, 400);
    assert.match((await response.json()).message, /שם פרטי ושם משפחה/);
  }
  assert.equal(writes, 0);
});

test('legacy single-name checkout never sends the club name as a customer surname', async () => {
  let body;
  const response = await worker.fetch(new Request('https://club.test/api/payments/rivhit/create', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'u', userName: 'מני', membershipType: 'OPEN_GYM', mode: 'REGISTRATION' })
  }), { RIVHIT_ENVIRONMENT: 'test', RIVHIT_GROUP_PRIVATE_TOKEN: 'test-token', PAYMENT_SIGNING_SECRET: 'test-signing-secret', PUBLIC_APP_URL: 'https://club.test/',
    RIVHIT_FETCH: async (_url, init) => {
      body = JSON.parse(init.body);
      return Response.json({ Status: 0, URL: 'https://testicredit.rivhit.co.il/payment/example', PrivateSaleToken: 'test-private-sale' });
    }
  });
  assert.equal(response.status, 200);
  assert.equal(body.CustomerFirstName, 'מני');
  assert.equal(body.CustomerLastName, '');
});
