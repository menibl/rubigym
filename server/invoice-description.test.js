import test from 'node:test';
import assert from 'node:assert/strict';
import { invoiceDescription } from '../shared/invoice-description.js';
import worker from './index.js';

test('invoice defaults, custom text and plan-name option have safe fallbacks', () => {
  assert.equal(invoiceDescription(undefined, 'Open Gym'), 'ייעוץ ואימון');
  assert.equal(invoiceDescription({ invoiceDescriptionText: '  ייעוץ\nואימון  ' }, 'Open Gym'), 'ייעוץ ואימון');
  assert.equal(invoiceDescription({ invoiceDescriptionText: '  ' }, 'Open Gym'), 'ייעוץ ואימון');
  assert.equal(invoiceDescription({ invoiceDescriptionMode: 'PLAN_NAME', invoiceDescriptionText: 'אחר' }, 'אימון זוגי'), 'אימון זוגי');
  assert.equal(invoiceDescription({ invoiceDescriptionMode: 'PLAN_NAME' }), 'ייעוץ ואימון');
  assert.equal(invoiceDescription({ invoiceDescriptionText: 'א'.repeat(150) }).length, 100);
});

for (const mode of ['FIXED', 'PLAN_NAME']) test(`checkout uses manager invoice setting ${mode}, ignoring payer overrides`, async () => {
  let sent;
  const response = await worker.fetch(new Request('https://club.test/api/payments/rivhit/create', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'new', userName: 'בדיקה', mode: 'REGISTRATION', membershipType: 'OPEN_GYM', invoiceDescriptionText: 'לא מורשה' })
  }), {
    RIVHIT_ENVIRONMENT: 'production', RIVHIT_GROUP_PRIVATE_TOKEN: 'fixture-token', PAYMENT_SIGNING_SECRET: 'fixture-signing-secret', PUBLIC_APP_URL: 'https://club.test/',
    STATE_STORE: { getClubState: async () => ({ payload: { settings: {
      invoiceDescriptionMode: mode, invoiceDescriptionText: 'שירותי ייעוץ ואימון',
      membershipPlans: [{ id: 'OPEN_GYM', label: 'מסלול פתוח', price: 280, active: true }]
    } } }) },
    RIVHIT_FETCH: async (_url, init) => { sent = JSON.parse(init.body); return Response.json({ Status: 0, URL: 'https://icredit.rivhit.co.il/payment/example', PrivateSaleToken: 'fixture-sale' }); }
  });
  assert.equal(response.status, 200);
  assert.equal(sent.Items[0].Description, mode === 'FIXED' ? 'שירותי ייעוץ ואימון' : 'מסלול פתוח');
  assert.equal(sent.Items[0].UnitPrice, 280);
  const order = JSON.parse(Buffer.from(sent.Custom1.split('.')[0], 'base64url').toString());
  assert.equal(order.m, 'OPEN_GYM');
  assert.equal(order.a, 280);
});
