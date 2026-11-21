import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizePulseemResponse } from './pulseem-diagnostics.js';
import { sendPulseemSms } from './sms-auth.js';

const summary = value => summarizePulseemResponse({ status: 200 }, JSON.stringify(value), value);
test('nested, case-insensitive errors, array responses and validation messages are decoded', () => {
  for (const value of [{ Status: 'Error', ErrorData: [{ Error_Code: 17, Error_Description: 'Invalid sendId' }] },
    [{ status: 'Error', errors: [{ code: 17, message: 'Invalid sendId' }] }],
    { Result: { Error: { ErrorCode: 17, Description: 'Invalid sendId' } } }]) {
    const result = summary(value);
    assert.equal(result.code, '17'); assert.equal(result.message, 'Invalid sendId'); assert.equal(result.failureDetected, true);
  }
  const validation = summary({ errors: { sendId: ['Must be a UUID'], request: { APIKey: 'never retain this' } } });
  assert.equal(validation.message, 'Must be a UUID');
  assert.equal(JSON.stringify(validation).includes('never retain'), false);
  assert.equal(summary({ Status: 'OK', ErrorData: null, ErrorCode: 0 }).failureDetected, false);
  assert.equal(summary({ Status: 'Error', Data: 'Invalid request' }).message, 'Invalid request');
  assert.equal(summary({ StatusCode: 200, Status: 'Error', ErrorData: { ErrorCode: 17 } }).code, '17');
  assert.equal(summary(false).failureDetected, true);
  assert.equal(summary(17).code, '17');
});

test('unknown payload fields and echoed credentials, phone, OTP, body, email and URL are not retained', () => {
  const context = { apiKey: 'short-secret-key', fromNumber: 'BALY', phone: '0501234567', reference: 'request-ref', text: 'OTP 123456\nprivate message body' };
  const value = { Status: 'Error', APIKey: context.apiKey, Request: { text: context.text },
    ErrorData: { Code: 'E_REJECTED', Message: `Bad ${context.apiKey} ${context.phone} +972-50-123-4567 123456 request-ref private message body customer@example.com https://secret.invalid/key` } };
  const result = summarizePulseemResponse({ status: 400 }, JSON.stringify(value), value, context);
  assert.match(result.message, /Bad/);
  const serialized = JSON.stringify(result);
  for (const sensitive of [context.apiKey, context.phone, '123456', 'request-ref', 'private message body', 'customer@example.com', 'secret.invalid']) assert.equal(serialized.includes(sensitive), false, sensitive);
});

test('plain text errors are captured, HTML bodies omitted and diagnostic expansion bounded', () => {
  const text = summarizePulseemResponse({ status: 503 }, 'Service unavailable', null);
  assert.equal(text.message, 'Service unavailable');
  const html = summarizePulseemResponse({ status: 502 }, '<html>private-body</html>', null);
  assert.equal(JSON.stringify(html).includes('private-body'), false);
  const many = summary({ errors: Array.from({ length: 1000 }, () => ({ message: 'x'.repeat(10000) })) });
  assert.ok(many.details.length <= 12); assert.equal(many.truncated, true); assert.ok(JSON.stringify(many).length < 5000);
  assert.equal(summary({ errorMessage: 'x '.repeat(1000) }).truncated, true);
});

test('HTTP 200 nested rejection is not mistaken for success; OTP UUID request remains unchanged', async () => {
  const reference = '00000000-0000-4000-8000-000000000001'; let request;
  await assert.rejects(() => sendPulseemSms({ env: { PULSEEM_API_KEY: 'synthetic', PULSEEM_FROM_NUMBER: 'BALY' },
    phone: '0500000000', text: 'test only', reference, fetchImpl: async (_url, init) => {
      request = JSON.parse(init.body);
      return new Response(JSON.stringify({ data: [{ status: 'Error', errorCode: 17, errorMessage: 'Rejected' }] }), { status: 200 });
    } }), error => error.provider.code === '17' && error.provider.message === 'Rejected');
  assert.equal(request.sendId, reference); assert.deepEqual(request.smsSendData.referenceList, [reference]);
  assert.equal(request.isAsync, false); assert.equal(request.smsSendData.isAutomaticUnsubscribeLink, false);
});
