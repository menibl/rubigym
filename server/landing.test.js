import assert from 'node:assert/strict';
import test from 'node:test';
import worker from './index.js';

const updatedAt = new Date('2026-08-23T10:00:00.000Z');
const stateStore = {
  async getClubState() {
    return {
      revision: 4,
      payload: {
        settings: {
          membershipPlans: [
            { id: 'OPEN_GYM', label: 'Open Gym', description: 'אימון חופשי', price: 280, category: 'PRIMARY', active: true },
            { id: 'HIDDEN', label: 'Hidden', description: 'לא לפרסום', price: 1, category: 'PRIMARY', active: false }
          ],
          internalOnly: 'must-not-leak'
        },
        users: [{ id: 'private-user', email: 'private@example.com' }]
      }
    };
  },
  async listLandingMedia() {
    return [{ slot: 'hero', mime_type: 'image/jpeg', size: 3, updated_at: updatedAt }];
  },
  async getLandingMedia(_clubId, slot) {
    return slot === 'hero' ? { mime_type: 'image/jpeg', body: Buffer.from([1, 2, 3]), updated_at: updatedAt } : null;
  },
  async getSession() { return null; }
};

const env = {
  CLUB_ID: 'baly-wellness',
  LANDING_DOMAIN: 'join.example.com',
  PUBLIC_APP_URL: 'https://app.example.com/',
  PUBLIC_LANDING_URL: 'https://join.example.com/',
  STATE_STORE: stateStore
};

test('public landing config selects the marketing surface and exposes only safe fields', async () => {
  const response = await worker.fetch(new Request('https://join.example.com/api/public/landing'), env);
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.surface, 'landing');
  assert.equal(payload.appUrl, 'https://app.example.com/');
  assert.equal(payload.plans.length, 1);
  assert.equal(payload.plans[0].id, 'OPEN_GYM');
  assert.equal(payload.users, undefined);
  assert.equal(payload.internalOnly, undefined);
  assert.match(payload.images.hero, /^\/api\/public\/landing-media\/hero\?v=\d+$/);
  assert.equal(payload.images.coaching, null);
});

test('the application hostname does not render the marketing surface', async () => {
  const response = await worker.fetch(new Request('https://app.example.com/api/public/landing'), env);
  assert.equal((await response.json()).surface, 'app');
});

test('public landing media is readable while manager upload remains protected', async () => {
  const imageResponse = await worker.fetch(new Request('https://join.example.com/api/public/landing-media/hero'), env);
  assert.equal(imageResponse.status, 200);
  assert.equal(imageResponse.headers.get('Content-Type'), 'image/jpeg');
  assert.deepEqual([...new Uint8Array(await imageResponse.arrayBuffer())], [1, 2, 3]);

  const uploadResponse = await worker.fetch(new Request('https://app.example.com/api/landing-media/hero', {
    method: 'PUT',
    headers: { 'Content-Type': 'image/jpeg' },
    body: Buffer.from([1, 2, 3])
  }), env);
  assert.equal(uploadResponse.status, 401);
});

test('a manager can replace and reset each landing image slot', async () => {
  const saved = [];
  const managerStore = {
    ...stateStore,
    async getSession() { return { club_id: 'baly-wellness', user_id: 'manager-1' }; },
    async getAccount() { return { user_id: 'manager-1', role: 'MANAGER' }; },
    async putLandingMedia(clubId, slot, mimeType, body) {
      saved.push({ clubId, slot, mimeType, body: [...body] });
      return { size: body.length, updated_at: updatedAt };
    },
    async deleteLandingMedia(clubId, slot) { saved.push({ clubId, slot, deleted: true }); }
  };
  const managerEnv = { ...env, STATE_STORE: managerStore };
  const headers = { Cookie: 'baly_session=manager-test-token', 'Content-Type': 'image/webp' };
  const uploadResponse = await worker.fetch(new Request('https://app.example.com/api/landing-media/coaching', {
    method: 'PUT', headers, body: Buffer.from([4, 5, 6])
  }), managerEnv);
  assert.equal(uploadResponse.status, 200);
  assert.deepEqual(saved[0], {
    clubId: 'baly-wellness', slot: 'coaching', mimeType: 'image/webp', body: [4, 5, 6]
  });

  const resetResponse = await worker.fetch(new Request('https://app.example.com/api/landing-media/coaching', {
    method: 'DELETE', headers: { Cookie: 'baly_session=manager-test-token' }
  }), managerEnv);
  assert.equal(resetResponse.status, 200);
  assert.deepEqual(saved[1], { clubId: 'baly-wellness', slot: 'coaching', deleted: true });
});
