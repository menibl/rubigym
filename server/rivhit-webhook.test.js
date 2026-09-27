import assert from 'node:assert/strict';
import test from 'node:test';
import worker from './index.js';

async function fixture() {
  let signedOrder;
  let verifyCalls = 0;
  let detailsCalls = 0;
  const env = {
    RIVHIT_ENVIRONMENT: 'test', RIVHIT_GROUP_PRIVATE_TOKEN: 'test-page',
    PAYMENT_SIGNING_SECRET: 'webhook-test-secret', PUBLIC_APP_URL: 'https://club.test/',
    RIVHIT_FETCH: async (url, init) => {
      const body = JSON.parse(init.body);
      if (url.endsWith('/GetUrl')) {
        signedOrder = body.Custom1;
        return Response.json({ Status: 0, URL: 'https://testicredit.rivhit.co.il/pay', PrivateSaleToken: 'test-sale-private' });
      }
      if (url.endsWith('/SaleDetails')) {
        detailsCalls++;
        assert.equal(body.SaleId, 'sale-1');
        return Response.json({ Status: 0, data: [{ SaleId: 'sale-1', Amount: 1, Custom1: signedOrder }] });
      }
      if (url.endsWith('/Verify')) {
        verifyCalls++;
        assert.equal(body.TotalAmount, 1);
        assert.equal(body.SaleId, 'sale-1');
        return Response.json({ Status: 'VERIFIED' });
      }
      throw new Error('Unexpected provider call');
    }
  };
  const response = await worker.fetch(new Request('https://club.test/api/payments/rivhit/create', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'trainee', userName: 'Test', mode: 'REGISTRATION', membershipType: 'OPEN_GYM' })
  }), env);
  assert.equal(response.status, 200);
  return { env, payload: { SaleId: 'sale-1', Custom1: signedOrder, TransactionAmount: '1.00' },
    counts: () => ({ verifyCalls, detailsCalls }) };
}

for (const format of ['form', 'json', 'array']) {
  test(`accepts documented TransactionAmount in ${format} IPN after provider verification`, async () => {
    const f = await fixture();
    const response = await worker.fetch(new Request('https://club.test/api/payments/rivhit/webhook', {
      method: 'POST', headers: { 'Content-Type': format === 'form' ? 'application/x-www-form-urlencoded' : 'application/json' },
      body: format === 'form' ? new URLSearchParams(f.payload).toString() : JSON.stringify(format === 'array' ? [f.payload] : f.payload)
    }), f.env);
    assert.equal(response.status, 200);
    assert.deepEqual(f.counts(), { verifyCalls: 1, detailsCalls: 0 });
  });
}

test('SaleId-only GET recovers signed order through SaleDetails and verifies it', async () => {
  const f = await fixture();
  const response = await worker.fetch(new Request('https://club.test/api/payments/rivhit/webhook?SaleId=sale-1'), f.env);
  assert.equal(response.status, 200);
  assert.deepEqual(f.counts(), { verifyCalls: 1, detailsCalls: 1 });
});

for (const patch of [{ TransactionAmount: '2.00' }, { Custom1: 'tampered.signature' }]) {
  test(`rejects invalid IPN ${Object.keys(patch)[0]} without verifying or crediting`, async () => {
    const f = await fixture();
    const response = await worker.fetch(new Request('https://club.test/api/payments/rivhit/webhook', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...f.payload, ...patch })
    }), f.env);
    assert.equal(response.status, 502);
    assert.equal(f.counts().verifyCalls, 0);
  });
}
