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
  assert.equal(providerRequest.body.Items[0].UnitPrice, 1);
  assert.equal(providerRequest.body.CustomerFirstName, 'מני');
  assert.equal(providerRequest.body.CustomerLastName, 'בללי');
  assert.match(providerRequest.body.IPNURL, /\/api\/payments\/rivhit\/webhook$/);
  assert.ok(providerRequest.body.Custom1);
});

test('RIVHIT production environment uses the production iCredit host', async () => {
  let requestedUrl = '', providerRequest;
  const env = {
    RIVHIT_ENVIRONMENT: 'production',
    RIVHIT_GROUP_PRIVATE_TOKEN: 'production-group-private-token',
    PAYMENT_SIGNING_SECRET: 'rivhit-production-signing-secret-with-entropy',
    PUBLIC_APP_URL: 'https://balywellness.com/',
    RIVHIT_TEST_CHARGE_AMOUNT: '1',
    RIVHIT_FETCH: async (url, init) => {
      requestedUrl = url;
      providerRequest = JSON.parse(init.body);
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
  assert.equal(providerRequest.Items[0].UnitPrice, 280);
});

test('RIVHIT TEST checkout accepts a configured charge amount up to the sandbox limit', async () => {
  let providerRequest;
  const env = {
    RIVHIT_ENVIRONMENT: 'test',
    RIVHIT_GROUP_PRIVATE_TOKEN: 'test-group-private-token',
    RIVHIT_TEST_CHARGE_AMOUNT: '120',
    PAYMENT_SIGNING_SECRET: 'rivhit-test-signing-secret-with-enough-entropy',
    PUBLIC_APP_URL: 'https://balywellness.test/',
    RIVHIT_FETCH: async (_url, init) => {
      providerRequest = JSON.parse(init.body);
      return Response.json({ Status: 0, URL: 'https://testicredit.rivhit.co.il/payment/example', PrivateSaleToken: 'private-token' });
    }
  };
  const response = await worker.fetch(new Request('https://balywellness.test/api/payments/rivhit/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'new-trainee', userName: 'בדיקה', membershipType: 'OPEN_GYM', mode: 'REGISTRATION' })
  }), env);
  assert.equal(response.status, 200);
  assert.equal(providerRequest.Items[0].UnitPrice, 120);
});

test('RIVHIT provider rejection returns its safe diagnostic message', async () => {
  const env = {
    RIVHIT_ENVIRONMENT: 'test',
    RIVHIT_GROUP_PRIVATE_TOKEN: 'test-group-private-token',
    PAYMENT_SIGNING_SECRET: 'rivhit-test-signing-secret-with-enough-entropy',
    PUBLIC_APP_URL: 'https://balywellness.test/',
    RIVHIT_FETCH: async () => Response.json({
      Status: -1,
      DebugMessage: 'Payment page does not exists'
    }, { status: 500 })
  };
  const response = await worker.fetch(new Request('https://balywellness.test/api/payments/rivhit/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'new-trainee', userName: 'בדיקה', membershipType: 'OPEN_GYM', mode: 'REGISTRATION' })
  }), env);

  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { message: 'Payment page does not exists' });
});

test('RIVHIT non-JSON upstream failure remains a generic unavailable response', async () => {
  const env = {
    RIVHIT_ENVIRONMENT: 'test',
    RIVHIT_GROUP_PRIVATE_TOKEN: 'test-group-private-token',
    PAYMENT_SIGNING_SECRET: 'rivhit-test-signing-secret-with-enough-entropy',
    PUBLIC_APP_URL: 'https://balywellness.test/',
    RIVHIT_FETCH: async () => new Response('<html>gateway unavailable</html>', {
      status: 502,
      headers: { 'Content-Type': 'text/html' }
    })
  };
  const response = await worker.fetch(new Request('https://balywellness.test/api/payments/rivhit/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'new-trainee', userName: 'בדיקה', membershipType: 'OPEN_GYM', mode: 'REGISTRATION' })
  }), env);

  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { message: 'שירות השרת אינו זמין כרגע. נסו שוב מאוחר יותר.' });
});

test('checkout uses the manager configured plan price and fixed period', async () => {
  let providerRequest;
  const env = {
    RIVHIT_ENVIRONMENT: 'production',
    RIVHIT_GROUP_PRIVATE_TOKEN: 'production-group-private-token',
    PAYMENT_SIGNING_SECRET: 'rivhit-production-signing-secret-with-entropy',
    PUBLIC_APP_URL: 'https://balywellness.com/',
    STATE_STORE: {
      getClubState: async () => ({ payload: { settings: { membershipPlans: [{
        id: 'OPEN_GYM', label: 'Open Gym מעודכן', price: 777, active: true, billingPeriod: 'THREE_MONTHS'
      }] } } })
    },
    RIVHIT_FETCH: async (_url, init) => {
      providerRequest = JSON.parse(init.body);
      return Response.json({ Status: 0, URL: 'https://icredit.rivhit.co.il/payment/example', PrivateSaleToken: 'private-token' });
    }
  };
  const response = await worker.fetch(new Request('https://balywellness.com/api/payments/rivhit/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'new-trainee', userName: 'בדיקה', membershipType: 'OPEN_GYM', mode: 'REGISTRATION', planAmount: 1 })
  }), env);
  assert.equal(response.status, 200);
  assert.equal(providerRequest.Items[0].UnitPrice, 777);
  assert.equal(providerRequest.Items[0].Description, 'Open Gym מעודכן');
  assert.equal(providerRequest.CreateRecurringSale, undefined);
});

test('monthly annual commitment creates twelve recurring monthly charges when enabled', async () => {
  let providerRequest;
  const env = {
    RIVHIT_ENVIRONMENT: 'production',
    RIVHIT_ENABLE_RECURRING: 'true',
    RIVHIT_GROUP_PRIVATE_TOKEN: 'production-group-private-token',
    PAYMENT_SIGNING_SECRET: 'rivhit-production-signing-secret-with-entropy',
    PUBLIC_APP_URL: 'https://balywellness.com/',
    STATE_STORE: {
      getClubState: async () => ({ payload: { settings: { membershipPlans: [{
        id: 'GROUP_ANNUAL', label: 'קבוצתי שנתי', price: 525, active: true, billingPeriod: 'MONTHLY_ANNUAL_COMMITMENT'
      }] } } })
    },
    RIVHIT_FETCH: async (_url, init) => {
      providerRequest = JSON.parse(init.body);
      return Response.json({ Status: 0, URL: 'https://icredit.rivhit.co.il/payment/example', PrivateSaleToken: 'private-token' });
    }
  };
  const response = await worker.fetch(new Request('https://balywellness.com/api/payments/rivhit/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'new-trainee', userName: 'בדיקה', membershipType: 'GROUP_ANNUAL', mode: 'REGISTRATION' })
  }), env);
  assert.equal(response.status, 200);
  assert.equal(providerRequest.Items[0].UnitPrice, 525);
  assert.equal(providerRequest.SaleType, 2);
  assert.equal(providerRequest.CreateRecurringSale, true);
  assert.equal(providerRequest.RecurringSaleCount, 12);
});

test('monthly plan creates an open-ended recurring charge without an annual commitment', async () => {
  let providerRequest;
  const env = {
    RIVHIT_ENVIRONMENT: 'production',
    RIVHIT_ENABLE_RECURRING: 'true',
    RIVHIT_GROUP_PRIVATE_TOKEN: 'production-group-private-token',
    PAYMENT_SIGNING_SECRET: 'rivhit-production-signing-secret-with-entropy',
    PUBLIC_APP_URL: 'https://balywellness.com/',
    STATE_STORE: {
      getClubState: async () => ({ payload: { settings: { membershipPlans: [{
        id: 'OPEN_GYM', label: 'Open Gym חודשי', price: 310, active: true, billingPeriod: 'MONTHLY'
      }] } } })
    },
    RIVHIT_FETCH: async (_url, init) => {
      providerRequest = JSON.parse(init.body);
      return Response.json({ Status: 0, URL: 'https://icredit.rivhit.co.il/payment/example', PrivateSaleToken: 'private-token' });
    }
  };
  const response = await worker.fetch(new Request('https://balywellness.com/api/payments/rivhit/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'new-trainee', userName: 'בדיקה', membershipType: 'OPEN_GYM', mode: 'REGISTRATION' })
  }), env);
  assert.equal(response.status, 200);
  assert.equal(providerRequest.SaleType, 2);
  assert.equal(providerRequest.RecurringSaleCount, 0);
});
