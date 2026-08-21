import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveOpenAiApiKey } from './workout-ai.js';

test('reads and trims the OpenAI key from the server environment', () => {
  assert.equal(resolveOpenAiApiKey({ OPENAI_API_KEY: '  server-key-value  ' }), 'server-key-value');
  assert.equal(resolveOpenAiApiKey({}), '');
});
