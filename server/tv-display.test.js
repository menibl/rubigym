import assert from 'node:assert/strict';
import test from 'node:test';
import worker from './index.js';

const createEnv = () => {
  const requestedPaths = [];
  return {
    requestedPaths,
    env: {
      ASSETS: {
        async fetch(request) {
          requestedPaths.push(new URL(request.url).pathname);
          return new Response('asset', {status: 200});
        }
      }
    }
  };
};

test('serves the lightweight display from the permanent TV route', async () => {
  const fixture = createEnv();
  const response = await worker.fetch(new Request('https://balywellness.test/tv'), fixture.env);
  assert.equal(response.status, 200);
  assert.deepEqual(fixture.requestedPaths, ['/tv.html']);
});

test('keeps the legacy hash address working in the LG television browser', async () => {
  const fixture = createEnv();
  const response = await worker.fetch(new Request('https://balywellness.test/', {
    headers: {'User-Agent': 'Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 Chrome/68.0 Safari/537.36 WebAppManager LG Browser'}
  }), fixture.env);
  assert.equal(response.status, 200);
  assert.deepEqual(fixture.requestedPaths, ['/tv.html']);
});

test('continues serving the full application to regular browsers', async () => {
  const fixture = createEnv();
  const response = await worker.fetch(new Request('https://balywellness.test/', {
    headers: {'User-Agent': 'Mozilla/5.0 Chrome/120.0 Safari/537.36'}
  }), fixture.env);
  assert.equal(response.status, 200);
  assert.deepEqual(fixture.requestedPaths, ['/index.html']);
});
