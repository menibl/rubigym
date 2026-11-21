import test from 'node:test';
import assert from 'node:assert/strict';
import { announcementProviderReference, queueAnnouncement, queueAnnouncementSmsTest, sendAnnouncementSms } from './announcement-sms.js';
import { sendPulseemSms } from './sms-auth.js';
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
    postTest: data => worker.fetch(new Request('https://club.test/api/admin/announcements/sms-test', { method: 'POST',
      headers: { Cookie: 'baly_session=test', 'Content-Type': 'application/json' }, body: JSON.stringify(data) }), { STATE_STORE: store, CLUB_ID: 'club', ...credentials }),
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

test('provider UUID is persisted independently of permanent claims and reused on publication replay', async () => {
  const initial = queueAnnouncement(seed(), body, manager, now);
  const replay = queueAnnouncement(initial.payload, body, manager, now);
  const jobs = initial.payload.announcementSmsDeliveries;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  assert.ok(jobs.every(job => uuid.test(job.providerReference)));
  assert.equal(new Set(jobs.map(job => job.providerReference)).size, 2);
  assert.deepEqual(replay.payload.announcementSmsDeliveries, jobs);
  const api = fixture(initial.payload); const sent = []; const quiet = {};
  const send = async request => sent.push(request.reference);
  await Promise.all([sendAnnouncementSms(api.store, credentials, send, quiet), sendAnnouncementSms(api.store, credentials, send, quiet)]);
  await sendAnnouncementSms(api.store, credentials, send, quiet);
  assert.deepEqual(sent.sort(), jobs.map(job => job.providerReference).sort());
  assert.deepEqual([...api.claims].sort(), jobs.map(job => job.id).sort());
  assert.ok(api.state().payload.announcementSmsDeliveries.every(job => job.status === 'ACCEPTED'));
});

test('legacy pending jobs are retained for review without minting new IDs, sending or clearing claims', async () => {
  const payload = queueAnnouncement(seed(), body, manager, now).payload;
  payload.announcementSmsDeliveries.forEach(job => { delete job.providerReference; });
  const [job, old] = payload.announcementSmsDeliveries;
  assert.equal(announcementProviderReference(job), null);
  const api = fixture(payload); api.claims.add(old.id); const sent = [];
  await sendAnnouncementSms(api.store, credentials, async request => sent.push(request.reference), {});
  assert.deepEqual(sent, []);
  await sendAnnouncementSms(api.store, credentials, async request => sent.push(request.reference), {});
  assert.equal(sent.length, 0);
  assert.ok(api.claims.has(old.id));
  assert.ok(api.state().payload.announcementSmsDeliveries.every(job => job.status === 'FAILED_OR_UNKNOWN'
    && job.diagnostic.reason === 'LEGACY_REFERENCE_REVIEW_REQUIRED'));
});

test('announcement sends UUID in both Pulseem fields and persists sanitized nested error details', async () => {
  const api = fixture(queueAnnouncement(seed(), body, manager, now).payload); const requests = [];
  await sendAnnouncementSms(api.store, credentials, request => sendPulseemSms({ ...request, fetchImpl: async (_url, init) => {
    const data = JSON.parse(init.body); requests.push(data);
    return new Response(JSON.stringify({ Status: 'Error', ErrorData: [{ ErrorCode: 'E_REFERENCE',
      ErrorDescription: `Invalid reference ${data.sendId}; credential ${credentials.PULSEEM_API_KEY}` }] }), { status: 200 });
  } }), {});
  assert.equal(requests.length, 2);
  for (const request of requests) {
    assert.equal(request.sendId.length, 36);
    assert.deepEqual(request.smsSendData.referenceList, [request.sendId]);
  }
  for (const job of api.state().payload.announcementSmsDeliveries) {
    assert.equal(job.status, 'FAILED_OR_UNKNOWN');
    assert.equal(job.diagnostic.code, 'E_REFERENCE');
    assert.match(job.diagnostic.message, /Invalid reference/);
    assert.ok(job.diagnostic.details.some(detail => detail.path === '$.errordata[0]'));
    assert.equal(JSON.stringify(job.diagnostic).includes(credentials.PULSEEM_API_KEY), false);
    assert.equal(JSON.stringify(job.diagnostic).includes(job.providerReference), false);
  }
});

test('single-recipient test preview is read-only, confirmed send cannot publish or send to the audience', async () => {
  const initial = queueAnnouncement(seed(), body, manager, now).payload;
  const api = fixture(initial);
  const input = { announcementId: announcement.id, phone: '0500000000' };
  const previewResponse = await api.postTest({ ...input, action: 'preview' });
  assert.equal(previewResponse.status, 200);
  const preview = await previewResponse.json();
  assert.equal(preview.delivery, null); assert.equal(preview.phoneSuffix, '0000');
  assert.deepEqual(api.state().payload, initial);
  assert.equal((await api.postTest({ ...input, action: 'send', confirmed: true, fingerprint: 'stale' })).status, 409);
  const send = { ...input, action: 'send', confirmed: true, fingerprint: preview.fingerprint };
  const responses = await Promise.all([api.postTest(send), api.postTest(send)]);
  assert.deepEqual(responses.map(response => response.status).sort(), [200, 201]);
  const after = api.state().payload;
  assert.deepEqual(after.announcements, initial.announcements);
  assert.deepEqual(after.announcementSmsDeliveries.slice(0, 2), initial.announcementSmsDeliveries);
  assert.equal(after.announcementSmsDeliveries.length, 3);
  const testJob = after.announcementSmsDeliveries[2];
  assert.equal(testJob.phone, input.phone); assert.equal(testJob.testOnly, true); assert.equal(testJob.userId, manager.id);
  // Existing audience jobs were already claimed: the test must not reset them.
  initial.announcementSmsDeliveries.forEach(job => api.claims.add(job.id));
  const sent = [];
  await sendAnnouncementSms(api.store, credentials, async request => sent.push(request), {});
  assert.equal(sent.length, 1); assert.equal(sent[0].phone, input.phone); assert.equal(sent[0].reference.length, 36);
  const result = await (await api.postTest({ ...input, action: 'preview' })).json();
  assert.equal(result.delivery.status, 'ACCEPTED');
  assert.equal((await api.postTest(send)).status, 200);
  assert.equal((await api.postTest({ ...send, phone: '+972500000000' })).status, 200);
  await sendAnnouncementSms(api.store, credentials, async request => sent.push(request), {});
  assert.equal(sent.length, 1);
  const restarted = fixture(api.state().payload);
  await sendAnnouncementSms(restarted.store, credentials, async request => sent.push(request), {});
  assert.equal(sent.length, 1);
});

test('single-recipient test rejects non-managers, invalid phones and announcements from outside the club', async () => {
  const initial = queueAnnouncement(seed(), body, manager, now).payload;
  const input = { announcementId: announcement.id, phone: '0500000000', action: 'preview' };
  for (const role of ['TRAINEE', 'COACH']) assert.equal((await fixture(initial, role).postTest(input)).status, 403);
  const api = fixture(initial);
  assert.equal((await api.postTest({ ...input, phone: 'invalid' })).status, 400);
  assert.equal((await api.postTest({ ...input, announcementId: 'other-club' })).status, 404);
  assert.equal((await api.postTest({ ...input, action: 'send' })).status, 409);
  const prepared = queueAnnouncementSmsTest(initial, input, manager, now);
  assert.equal(prepared.payload, initial);
});
