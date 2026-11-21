import test from 'node:test';
import assert from 'node:assert/strict';
import { queueAnnouncement, sendAnnouncementSms } from './announcement-sms.js';
import { matchesAnnouncement } from '../shared/announcement-audience.js';
import { mergePayloadForUser, payloadForUser } from './auth.js';
import worker from './index.js';
const now = new Date('2026-11-13T10:00:00Z');
const manager = { id: 'manager', role: 'MANAGER', name: 'Manager' };
const trainee = (id, phone, patch = {}) => ({ id, phone, role: 'TRAINEE', gender: 'FEMALE', birthDate: '1990-01-01', membershipType: 'OPEN_GYM', ...patch });
const announcement = { id: 'ann-test', title: 'שעות המועדון', content: 'עדכון שעות הפעילות', targetGender: 'FEMALE', targetAgeMin: 18, targetMembershipTypes: ['OPEN_GYM'] };
const body = { announcement, sendSms: true };
const seed = () => ({ users: [manager, trainee('a', '0501234567'), trainee('b', '+972501234567'), trainee('missing', ''),
  trainee('male', '0501234568', { gender: 'MALE' }), trainee('youth', '0501234569', { birthDate: '2012-01-01' }),
  trainee('addon', '0501234570', { membershipType: 'WORKOUT_COACHING', secondaryMemberships: ['OPEN_GYM'] })], announcements: [] });
const credentials = { PULSEEM_API_KEY: 'synthetic', PULSEEM_FROM_NUMBER: 'synthetic' };
function fixture(payload = seed(), role = 'MANAGER') {
  let state = { revision: 1, payload }; const claims = new Set();
  const store = {
    getAllClubStates: async () => [{ club_id: 'club' }], getClubState: async () => structuredClone(state),
    getSession: async () => ({ club_id: 'club', user_id: 'manager' }), getAccount: async () => ({ user_id: 'manager', role }),
    claimPushDelivery: async (_club, id) => { if (claims.has(id)) return false; claims.add(id); return true; },
    putClubState: async (_club, next, revision) => {
      if (revision !== state.revision) return { conflict: true };
      state = { revision: revision + 1, payload: structuredClone(next) }; return { revision: state.revision };
    }
  };
  return { store, state: () => state, claims,
    post: data => worker.fetch(new Request('https://club.test/api/admin/announcements', { method: 'POST',
      headers: { Cookie: 'baly_session=test', 'Content-Type': 'application/json' }, body: JSON.stringify(data) }), { STATE_STORE: store, CLUB_ID: 'club', ...credentials }) };
}

test('SMS targets same audience, secondary memberships, real age and unique normalized phones', () => {
  const result = queueAnnouncement(seed(), body, manager, now);
  assert.equal(result.announcement.smsQueuedCount, 2);
  assert.equal(result.announcement.smsMissingPhoneCount, 1);
  assert.deepEqual(result.payload.announcementSmsDeliveries.map(job => job.userId), ['a', 'addon']);
  assert.equal(matchesAnnouncement(trainee('x', '', { age: 50, birthDate: '2012-01-01' }), announcement, now), false);
  assert.equal(matchesAnnouncement(trainee('x', '', { birthDate: undefined, age: undefined }), announcement, now), false);
  assert.equal(matchesAnnouncement(trainee('x', '', { membershipType: undefined }), { targetGender: 'ALL', targetMembershipTypes: [] }, now), true);
  assert.equal(matchesAnnouncement(trainee('x', '', { registrationIncomplete: true }), { targetGender: 'ALL' }, now), false);
});
test('SMS is opt-in, publication is idempotent, changes after publication cannot create a duplicate send', () => {
  const initial = queueAnnouncement(seed(), body, manager, now);
  const replay = queueAnnouncement(initial.payload, body, manager, now);
  assert.equal(replay.reused, true); assert.equal(replay.payload.announcementSmsDeliveries.length, 2);
  assert.throws(() => queueAnnouncement(initial.payload, { ...body, announcement: { ...announcement, content: 'changed' } }, manager, now), error => error.status === 409);
  const noSms = queueAnnouncement(seed(), { announcement }, manager, now);
  assert.equal(noSms.payload.announcementSmsDeliveries.length, 0);
  assert.throws(() => queueAnnouncement(seed(), { ...body, announcement: { ...announcement, content: 'x'.repeat(1001) } }, manager, now));
});
test('bounded SMS dispatch does not require push keys, cannot double send on concurrency/restart', async () => {
  const api = fixture(queueAnnouncement(seed(), body, manager, now).payload); const sent = [];
  const send = async data => { sent.push(data.phone); };
  await Promise.all([sendAnnouncementSms(api.store, credentials, send), sendAnnouncementSms(api.store, credentials, send)]);
  await sendAnnouncementSms(api.store, credentials, send);
  assert.equal(sent.length, 2); assert.equal(new Set(sent).size, 2);
  assert.ok(api.state().payload.announcementSmsDeliveries.every(job => job.status === 'ACCEPTED'));
});
test('provider failures are recorded but never blindly retried; deleted announcements cancel queued jobs', async () => {
  const api = fixture(queueAnnouncement(seed(), body, manager, now).payload); let calls = 0;
  await sendAnnouncementSms(api.store, credentials, async () => { calls++; throw Error('ambiguous timeout'); });
  await sendAnnouncementSms(api.store, credentials, async () => { calls++; });
  assert.equal(calls, 2); assert.ok(api.state().payload.announcementSmsDeliveries.every(job => job.status === 'FAILED_OR_UNKNOWN'));
  const deleted = fixture({ ...queueAnnouncement(seed(), body, manager, now).payload, announcements: [] });
  await sendAnnouncementSms(deleted.store, credentials, async () => { throw Error('must not send'); });
  assert.ok(deleted.state().payload.announcementSmsDeliveries.every(job => job.status === 'CANCELLED'));
});
test('SMS queue is server controlled and endpoint rejects trainees/coaches', async () => {
  for (const role of ['TRAINEE', 'COACH']) {
    const api = fixture(seed(), role);
    assert.equal((await api.post(body)).status, 403);
    assert.equal(api.state().payload.announcements.length, 0);
  }
  const api = fixture();
  assert.equal((await api.post(body)).status, 201);
  assert.equal((await api.post(body)).status, 200);
  assert.equal(api.state().payload.announcements.length, 1);
  const current = api.state().payload;
  const forged = { ...current, announcementSmsDeliveries: [{ id: 'forged', phone: '0501234567' }] };
  assert.deepEqual(mergePayloadForUser(current, forged, 'manager', 'MANAGER').announcementSmsDeliveries, current.announcementSmsDeliveries);
});
test('no SMS is sent without provider configuration and each tick has a twenty-recipient cap', async () => {
  const users = Array.from({ length: 30 }, (_, index) => trainee(`t${index}`, `05012345${String(index).padStart(2, '0')}`));
  const api = fixture(queueAnnouncement({ users }, body, manager, now).payload); let calls = 0;
  await sendAnnouncementSms(api.store, {}, async () => { calls++; }); assert.equal(calls, 0);
  await sendAnnouncementSms(api.store, credentials, async () => { calls++; }); assert.equal(calls, 20);
});

test('announcement diagnostics retain provider rejection code and reason without retrying or leaking sensitive data', async () => {
  const api = fixture(queueAnnouncement(seed(), body, manager, now).payload);
  const entries = []; const logger = { warn: (...args) => entries.push(args), info: (...args) => entries.push(args) };
  let calls = 0;
  await sendAnnouncementSms(api.store, credentials, async ({ phone, text }) => {
    calls++;
    throw Object.assign(new Error('do not retain arbitrary exception'), {
      provider: { httpStatus: 400, code: '17', status: 'rejected',
        message: `Sender rejected ${credentials.PULSEEM_API_KEY} ${phone} person@example.com https://test.invalid/key ${text}`,
        headers: { APIKey: credentials.PULSEEM_API_KEY }, arbitrary: 'must not persist' }
    });
  }, logger);
  const jobs = api.state().payload.announcementSmsDeliveries;
  for (const job of jobs) {
    assert.equal(job.status, 'FAILED_OR_UNKNOWN');
    assert.equal(job.diagnostic.httpStatus, 400);
    assert.equal(job.diagnostic.code, '17');
    assert.equal(job.diagnostic.reason, 'PROVIDER_REJECTED');
    assert.match(job.diagnostic.message, /Sender rejected/);
    assert.ok(job.diagnostic.message.length <= 180);
  }
  const safe = JSON.stringify([entries, jobs.map(job => job.diagnostic)]);
  for (const privateText of [credentials.PULSEEM_API_KEY, '0501234567', '0501234570', 'person@example.com',
    'https://test.invalid/key', announcement.title, announcement.content, 'arbitrary exception', 'must not persist']) {
    assert.equal(safe.includes(privateText), false, privateText);
  }
  assert.equal(entries.length, 2);
  assert.equal(safe.includes(jobs[0].id), false);
  await sendAnnouncementSms(api.store, credentials, async () => { calls++; }, logger);
  assert.equal(calls, 2);
  assert.deepEqual(payloadForUser(api.state().payload, 'a', 'TRAINEE').announcementSmsDeliveries, []);
  const forged = { ...api.state().payload, announcementSmsDeliveries: [] };
  assert.deepEqual(mergePayloadForUser(api.state().payload, forged, 'manager', 'MANAGER').announcementSmsDeliveries, jobs);
});

test('diagnostics distinguish acceptance, timeout and unknown transport failures without logging exception messages', async () => {
  for (const [failure, reason] of [[null, 'PROVIDER_ACCEPTED'],
    [Object.assign(new Error('secret network details'), { name: 'TimeoutError' }), 'TIMEOUT_OR_ABORT'],
    [new Error('secret network details'), 'TRANSPORT_OR_UNKNOWN']]) {
    const api = fixture(queueAnnouncement(seed(), body, manager, now).payload);
    const entries = []; const logger = { warn: (...args) => entries.push(args), info: (...args) => entries.push(args) };
    await sendAnnouncementSms(api.store, credentials, async () => {
      if (failure) throw failure;
      return { provider: { httpStatus: 200, code: 0, status: 'accepted', message: 'Queued successfully' } };
    }, logger);
    for (const job of api.state().payload.announcementSmsDeliveries) {
      assert.equal(job.diagnostic.reason, reason);
      assert.equal(job.status, failure ? 'FAILED_OR_UNKNOWN' : 'ACCEPTED');
      assert.ok(job.diagnostic.recordedAt);
      assert.equal(JSON.stringify(job.diagnostic).includes('secret network details'), false);
    }
    assert.equal(entries.length, 2);
  }
});

test('an empty thrown error remains unknown, never accepted', async () => {
  const api = fixture(queueAnnouncement(seed(), body, manager, now).payload);
  const entries = [];
  await sendAnnouncementSms(api.store, credentials, async () => { throw null; }, { warn: entry => entries.push(entry) });
  assert.equal(entries.length, 2);
  assert.ok(api.state().payload.announcementSmsDeliveries.every(job =>
    job.status === 'FAILED_OR_UNKNOWN' && job.diagnostic.reason === 'TRANSPORT_OR_UNKNOWN'));
});
