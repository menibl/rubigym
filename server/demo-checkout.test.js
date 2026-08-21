import assert from 'node:assert/strict';
import test from 'node:test';
import worker from './index.js';

const env = {
  DEMO_PAYMENT_MODE: 'true',
  PAYMENT_SIGNING_SECRET: 'demo-checkout-test-signing-secret',
  PUBLIC_APP_URL: 'https://balywellness.test/',
  PAYMENT_ALLOWED_ORIGIN: 'https://balywellness.test'
};

test('demo checkout confirmation works with a strict no-inline-script CSP', async () => {
  const createResponse = await worker.fetch(new Request('https://balywellness.test/api/payments/cardcom/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://balywellness.test' },
    body: JSON.stringify({
      userId: 'demo-user',
      userName: 'Demo User',
      membershipType: 'OPEN_GYM',
      mode: 'REGISTRATION',
      planAmount: 280,
      planLabel: 'Open Gym'
    })
  }), env);

  assert.equal(createResponse.status, 200);
  const checkout = await createResponse.json();
  const checkoutResponse = await worker.fetch(new Request(checkout.url), env);
  const html = await checkoutResponse.text();

  assert.equal(checkoutResponse.status, 200);
  assert.match(html, /<a class="pay" href="https:\/\/balywellness\.test\/\?cardcom=success">/);
  assert.doesNotMatch(html, /onclick=|<script/i);
});
