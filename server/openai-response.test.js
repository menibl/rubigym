import test from 'node:test';
import assert from 'node:assert/strict';
import { readOpenAiResponse } from './openai-response.js';
import { handleWorkoutAi } from './workout-ai.js';

test('200 empty, HTML, malformed and null/primitive/array JSON have explicit failures without storing the body', async () => {
  for (const [body, expected] of [['', 'OPENAI_EMPTY_BODY'], [' \n ', 'OPENAI_EMPTY_BODY'],
    ['<html>private-user@example.test</html>', 'OPENAI_INVALID_JSON'], ['{"output":', 'OPENAI_INVALID_JSON'],
    ['null', 'OPENAI_INVALID_RESPONSE_SHAPE'], ['false', 'OPENAI_INVALID_RESPONSE_SHAPE'], ['[]', 'OPENAI_INVALID_RESPONSE_SHAPE']]) {
    const result = await readOpenAiResponse(new Response(body, { headers: { 'content-type': 'text/html; charset=utf-8', 'x-request-id': 'req_example' } }), 'generation');
    assert.equal(result.failure, expected);
    assert.equal(result.diagnostics.httpStatus, 200);
    assert.equal(result.diagnostics.responseBytes, new TextEncoder().encode(body).length);
    assert.equal(result.diagnostics.requestId, 'req_example');
    assert.equal(result.result, undefined);
    assert.ok(!JSON.stringify(result).includes('private-user'));
  }
});

test('UTF-8 JSON including BOM remains supported and byte counts are accurate', async () => {
  const body = '\uFEFF' + JSON.stringify({ output_text: 'שלום' });
  const result = await readOpenAiResponse(new Response(body, { headers: { 'content-type': 'application/json' } }), 'generation');
  assert.deepEqual(result.result, { output_text: 'שלום' });
  assert.equal(result.diagnostics.responseBytes, new TextEncoder().encode(body).length);
});

test('read failures do not log exception text; untrusted headers and provider codes are not copied', async () => {
  const response = new Response('private-data', { headers: { 'content-type': 'private-data', 'x-request-id': 'private-user@example.test' } });
  response.arrayBuffer = async () => { throw new Error('private-data read failure'); };
  const result = await readOpenAiResponse(response, 'generation');
  assert.equal(result.failure, 'OPENAI_RESPONSE_READ_FAILED');
  assert.equal(result.diagnostics.responseBytes, null);
  assert.equal(result.diagnostics.contentType, 'other-or-missing');
  assert.equal(result.diagnostics.requestId, null);
  assert.ok(!JSON.stringify(result).includes('private-data'));
  const rejected = await readOpenAiResponse(Response.json({ error: { code: 'private-data', message: 'private-data' } }, { status: 400 }), 'generation');
  assert.equal(rejected.diagnostics.providerCode, 'unknown');
  assert.ok(!JSON.stringify(rejected).includes('private-data'));
});

async function run(t, replies) {
  const logs = [];
  t.mock.method(console, 'error', (...args) => logs.push(args));
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    assert.equal(JSON.parse(init.body).model, 'gpt-5-mini');
    assert.equal(init.headers.Accept, 'application/json');
    return replies[calls++]();
  });
  const request = new Request('https://app.test/api/ai/workout-plan', { method: 'POST',
    body: JSON.stringify({ scope: 'PERSONAL', message: 'private-request', actor: { id: 'private-user' } }) });
  const response = await handleWorkoutAi(request, { OPENAI_API_KEY: 'fixture-key', AI_REQUESTS_PER_HOUR: 10000 }, {},
    (body, status) => Response.json(body, { status }));
  const body = await response.json();
  assert.ok(!JSON.stringify(logs).includes('private-'));
  assert.ok(!JSON.stringify(logs).includes('fixture-key'));
  return { response, body, logs, calls };
}

test('handler diagnoses HTTP 200 malformed JSON with one upstream call and no raw content in logs', async t => {
  const result = await run(t, [() => new Response('<html>private-provider-data</html>', { headers: { 'content-type': 'text/html', 'x-request-id': 'req_example' } })]);
  assert.equal(result.response.status, 502);
  assert.equal(result.body.code, 'OPENAI_INVALID_JSON');
  assert.equal(result.calls, 1);
  assert.equal(result.logs.length, 1);
  const log = JSON.parse(result.logs[0][1]);
  assert.equal(log.httpStatus, 200); assert.equal(log.contentType, 'text/html'); assert.equal(log.requestId, 'req_example');
});

test('successful generation is unchanged, without logs or extra provider calls', async t => {
  const plan = { assistantMessage: 'תוכנית מוכנה', exercises: [] };
  const result = await run(t, [() => Response.json({ output_text: JSON.stringify(plan), model: 'gpt-5-mini' })]);
  assert.equal(result.response.status, 200);
  assert.deepEqual(result.body.result, plan);
  assert.equal(result.logs.length, 0); assert.equal(result.calls, 1);
});

test('Hebrew correction errors receive the same safe diagnostics with correct stage', async t => {
  const result = await run(t, [() => Response.json({ output_text: '{"name":"English"}' }), () => new Response('')]);
  assert.equal(result.body.code, 'OPENAI_EMPTY_BODY'); assert.equal(result.calls, 2);
  assert.equal(JSON.parse(result.logs[0][1]).stage, 'hebrew-correction');
});

test('provider statuses retain auth/model/rate-limit handling without unsafe provider messages', async t => {
  for (const [status, expected] of [[401, 502], [404, 502], [429, 429], [500, 502]]) {
    await t.test(`HTTP ${status}`, async sub => {
      const result = await run(sub, [() => Response.json({ error: { code: 'server_error', message: 'private-provider-data' } }, { status })]);
      assert.equal(result.response.status, expected);
      assert.equal(result.body.code, 'OPENAI_REQUEST_REJECTED'); assert.equal(result.calls, 1);
    });
  }
});

test('plan JSON parse errors do not leak model answer through SyntaxError.message', async t => {
  const result = await run(t, [() => Response.json({ output_text: 'private-invalid-plan-json' })]);
  assert.equal(result.response.status, 502);
  assert.equal(result.body.code, 'OPENAI_INVALID_PLAN_JSON');
  assert.equal(result.calls, 1);
});

test('a JSON null plan is not presented as a successful program', async t => {
  const result = await run(t, [() => Response.json({ output_text: 'null' })]);
  assert.equal(result.response.status, 502);
  assert.equal(result.body.code, 'OPENAI_INVALID_PLAN_SHAPE');
});
