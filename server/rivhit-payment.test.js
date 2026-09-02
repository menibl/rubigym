import assert from 'node:assert/strict';
import test from 'node:test';
import worker from './index.js';

test('RIVHIT TEST checkout uses hosted GetUrl and never exposes the private token', async () => {
  let providerRequest;
  const env = {
    RIVHIT_ENVIRONMENT: 'test',
    RIVHIT_GROUP_PRIVATE_TOKEN: 'test-group-private-token',
    PAYMENT_SIGNING_SECRET: 'rivhit-test-signing-secret-with-enough-entropy',
    PUBLIC_APP_URL: 'https://balywellness.test/',
    PAYMENT_ALLOWED_ORIGIN: 'https://balywellness.test',
    RIVHIT_FETCH: async (url, init) => {
      providerRequest = { url, body: JSON.parse(init.body) };
      return Response.json({
        Status: 0,
        URL: 'https://testicredit.rivhit.co.il/payment/example',
        PrivateSaleToken: 'private-token-must-stay-signed',
        PublicSaleToken: 'public-token'
      });
    }
  };
  const response = await worker.fetch(new Request('https://balywellness.test/api/payments/rivhit/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://balywellness.test' },
    body: JSON.stringify({
      userId: 'new-trainee',
      userName: 'מני בללי',
      email: 'meni@example.com',
      phone: '0547332390',
      membershipType: 'NUTRITION_COACHING',
      mode: 'REGISTRATION'
    })
  }), env);

  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.url, 'https://testicredit.rivhit.co.il/payment/example');
  assert.ok(result.paymentReference);
  assert.equal(JSON.stringify(result).includes('private-token-must-stay-signed'), false);
  assert.equal(providerRequest.url, 'https://testicredit.rivhit.co.il/API/PaymentPageRequest.svc/GetUrl');
  assert.equal(providerRequest.body.GroupPrivateToken, 'test-group-private-token');
  assert.equal(providerRequest.body.Items[0].UnitPrice, 350);
  assert.equal(providerRequest.body.CustomerFirstName, 'מני');
  assert.equal(providerRequest.body.CustomerLastName, 'בללי');
  assert.match(providerRequest.body.IPNURL, /\/api\/payments\/rivhit\/webhook$/);
  assert.ok(providerRequest.body.Custom1);
});

test('RIVHIT production environment uses the production iCredit host', async () => {
  let requestedUrl = '';
  const env = {
    RIVHIT_ENVIRONMENT: 'production',
    RIVHIT_GROUP_PRIVATE_TOKEN: 'production-group-private-token',
    PAYMENT_SIGNING_SECRET: 'rivhit-production-signing-secret-with-entropy',
    PUBLIC_APP_URL: 'https://balywellness.com/',
    RIVHIT_FETCH: async url => {
      requestedUrl = url;
      return Response.json({ Status: 0, URL: 'https://icredit.rivhit.co.il/payment/example', PrivateSaleToken: 'private-token' });
    }
  };
  const response = await worker.fetch(new Request('https://balywellness.com/api/payments/rivhit/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'new-trainee', userName: 'בדיקה', membershipType: 'OPEN_GYM', mode: 'REGISTRATION' })
  }), env);
  assert.equal(response.status, 200);
  assert.equal(requestedUrl, 'https://icredit.rivhit.co.il/API/PaymentPageRequest.svc/GetUrl');
});
