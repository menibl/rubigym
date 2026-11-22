import test from 'node:test';
import assert from 'node:assert/strict';
import { splitPersonName, hasFullPersonName, invoiceCustomerName } from '../shared/person-name.js';
import worker from './index.js';

test('names support Hebrew, compound surnames, whitespace and real foreign surnames', () => {
  assert.deepEqual(splitPersonName('  מני\tבללי  '), { firstName: 'מני', lastName: 'בללי' });
  assert.deepEqual(splitPersonName('אנה איזביצקי כהן'), { firstName: 'אנה', lastName: 'איזביצקי כהן' });
  assert.equal(hasFullPersonName('Jean-Luc Van der Meer'), true);
  assert.equal(hasFullPersonName('רובי באלי'), true);
  assert.equal(hasFullPersonName('John BALY'), true); // Real supplied names are not rewritten.
});

test('invoice identity always uses the canonical payer name, never a username or cached browser name', () => {
  const users = [{ id: 'payer', name: 'עדי פנצ׳ר', username: 'adi-login' }, { id: 'child', name: 'נדב פנצר' }];
  assert.deepEqual(invoiceCustomerName(users, 'payer', 'עדי BALY'), { firstName: 'עדי', lastName: 'פנצ׳ר' });
  assert.deepEqual(invoiceCustomerName(users, 'payer', 'נדב פנצר'), { firstName: 'עדי', lastName: 'פנצ׳ר' });
  assert.equal(invoiceCustomerName([{ ...users[0], name: 'עדי' }], 'payer', 'עדי פנצ׳ר'), null);
  assert.equal(invoiceCustomerName(users, 'missing', 'עדי פנצ׳ר'), null);
  assert.deepEqual(invoiceCustomerName(undefined, 'registration', 'עדי פנצ׳ר'), { firstName: 'עדי', lastName: 'פנצ׳ר' });
});

for (const mode of ['REGISTRATION', 'PRIMARY', 'ADDON']) test(`new ${mode} page takes full name from server, not browser`, async () => {
  let sent;
  const response = await worker.fetch(new Request('https://club.test/api/payments/rivhit/create', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: 'baly_session=fixture' },
    body: JSON.stringify({ userId: 'u', userName: 'Wrong Username', membershipType: 'NUTRITION_COACHING', mode })
  }), { RIVHIT_ENVIRONMENT: 'test', RIVHIT_GROUP_PRIVATE_TOKEN: 'fixture', PAYMENT_SIGNING_SECRET: 'fixture-signing-secret', PUBLIC_APP_URL: 'https://club.test/',
    STATE_STORE: { getSession: async () => ({ user_id: 'u', club_id: 'baly-wellness' }), getClubState: async () => ({ payload: { users: [{ id: 'u', name: 'עדי פנצ׳ר', username: 'adi' }] } }) },
    RIVHIT_FETCH: async (_url, init) => { sent = JSON.parse(init.body); return Response.json({ Status: 0, URL: 'https://testicredit.rivhit.co.il/pay', PrivateSaleToken: 'fixture' }); }
  });
  assert.equal(response.status, 200, await response.text());
  assert.equal(sent.CustomerFirstName, 'עדי');
  assert.equal(sent.CustomerLastName, 'פנצ׳ר');
});

test('canonical single-name profile cannot be bypassed by sending a full name from the browser', async () => {
  let providerCalls = 0, writes = 0;
  const response = await worker.fetch(new Request('https://club.test/api/payments/rivhit/create', {
    method: 'POST', body: JSON.stringify({ userId: 'u', userName: 'עדי פנצ׳ר', membershipType: 'OPEN_GYM', mode: 'REGISTRATION' })
  }), { RIVHIT_ENVIRONMENT: 'test', RIVHIT_GROUP_PRIVATE_TOKEN: 'fixture', PAYMENT_SIGNING_SECRET: 'fixture', PUBLIC_APP_URL: 'https://club.test/',
    STATE_STORE: { getClubState: async () => ({ payload: { users: [{ id: 'u', name: 'עדי', username: 'פנצר' }] } }), putClubState: async () => { writes++; } },
    RIVHIT_FETCH: async () => { providerCalls++; throw new Error('must not dispatch'); }
  });
  assert.equal(response.status, 422);
  assert.equal((await response.json()).code, 'INVOICE_FULL_NAME_REQUIRED');
  assert.equal(providerCalls, 0); assert.equal(writes, 0);
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

test('legacy single-name checkout requires a real surname before any provider call', async () => {
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
  assert.equal(response.status, 422);
  assert.equal((await response.json()).code, 'INVOICE_FULL_NAME_REQUIRED');
  assert.equal(body, undefined);
});
