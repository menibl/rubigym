import test from 'node:test';
import assert from 'node:assert/strict';
import { createCoachArrivalApproval, coachExceptionChoices, redeemCoachArrivalApproval, recordHistoricalCoachArrival, recordCoachExceptionScan, COACH_EXCEPTION_PREFIX, preserveCoachArrivalAudit } from '../shared/coach-exception-arrival.js';
import { clubArrivalChoices } from '../shared/club-check-in.js';
import { payloadForUser, mergePayloadForUser } from './auth.js';
import worker from './index.js';
import { clubDate } from '../shared/membership-calendar.js';
import QRCode from 'qrcode';
import jsQR from 'jsqr';

const now = Date.parse('2026-10-06T09:00:00Z');
const traineeId = '2d2e8f20-42a1-4e48-a9bc-e617af237c45';
const token = '59ed8f20-42a1-4e48-a9bc-e617af237c45';
const fixture = () => ({ settings: {}, messages: [], attendanceLogs: [], sessions: [], openGymSessions: [], users: [
  { id: 'coach', name: 'מאמן', role: 'COACH' }, { id: 'manager', name: 'מנהל', role: 'MANAGER' },
  { id: traineeId, name: 'מתאמן', role: 'TRAINEE', familyId: 'family', membershipType: 'PERSONAL_TRAINING', secondaryMemberships: ['DUO_TRAINING'], membershipStatus: 'ACTIVE', membershipExpiry: '2026-11-01', personalTrainingRemaining: 6, personalTrainingCardSize: 10, duoTrainingRemaining: 4, duoTrainingCardSize: 10, healthDeclarationSigned: true, healthDeclarationDate: '2026-09-01' },
  { id: 'partner', name: 'בת זוג', role: 'TRAINEE', familyId: 'family', familyPayerId: traineeId, healthDeclarationSigned: true, healthDeclarationDate: '2026-09-01' }
] });
const create = state => createCoachArrivalApproval(state, 'coach', { traineeId, reason: 'אימון ביומן שאינו מתאים למסלול' }, token, now);
const redeem = (type = 'SOLO') => ({ code: COACH_EXCEPTION_PREFIX + token, type: 'SESSION', targetId: token, trainingType: type, partnerId: 'partner', confirmUnscheduled: true });

test('phone scanner QR fallback decodes the separate approval code without changing the printed club code', () => {
  const code = COACH_EXCEPTION_PREFIX + token, qr = QRCode.create(code, { errorCorrectionLevel: 'M' });
  const scale = 6, margin = 4, size = (qr.modules.size + margin * 2) * scale;
  const pixels = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const row = Math.floor(y / scale) - margin, column = Math.floor(x / scale) - margin;
    const dark = row >= 0 && column >= 0 && row < qr.modules.size && column < qr.modules.size && qr.modules.get(row, column);
    const i = (y * size + x) * 4; pixels[i] = pixels[i + 1] = pixels[i + 2] = dark ? 0 : 255; pixels[i + 3] = 255;
  }
  assert.equal(jsQR(pixels, size, size).data, code);
});

test('targeted single-use approval offers only personal/duo, leaves calendar unchanged and debits the selected card once', () => {
  for (const type of ['SOLO', 'DUO']) {
    const state = fixture(); state.sessions = [{ id: 'group', date: '2026-10-06', time: '12:00', durationMinutes: 60, registeredUsers: [traineeId], isPersonalTraining: false }];
    assert.deepEqual(clubArrivalChoices(state, traineeId, now).map(c => c.trainingType), ['GROUP']);
    const approval = create(state);
    assert.equal(Date.parse(approval.expiresAt) - now, 10 * 60000);
    const choices = coachExceptionChoices(approval.payload, traineeId, approval.code, now);
    assert.deepEqual(choices.map(c => c.trainingType), ['SOLO', 'DUO']);
    assert.ok(choices.every(c => c.exception && c.type === 'SESSION'));
    assert.throws(() => redeemCoachArrivalApproval(approval.payload, traineeId, { ...redeem(type), confirmUnscheduled: false }, now), /לאשר/);
    const next = redeemCoachArrivalApproval(approval.payload, traineeId, redeem(type), now);
    const user = next.users.find(u => u.id === traineeId);
    assert.equal(user.personalTrainingRemaining, type === 'SOLO' ? 5 : 6);
    assert.equal(user.duoTrainingRemaining, type === 'DUO' ? 3 : 4);
    assert.deepEqual(next.sessions, state.sessions);
    assert.equal(next.attendanceLogs.length, type === 'DUO' ? 2 : 1);
    assert.equal(next.attendanceLogs[0].approvedBy, 'coach');
    assert.equal(next.attendanceLogs[0].approvalReason, 'אימון ביומן שאינו מתאים למסלול');
    assert.equal(redeemCoachArrivalApproval(next, traineeId, redeem(type), now + 1000), next);
    assert.throws(() => redeemCoachArrivalApproval(next, traineeId, redeem(type === 'DUO' ? 'SOLO' : 'DUO'), now), /כבר מומש/);
    assert.equal(next.messages.filter(m => m.receiverId === traineeId).length, 1);
  }
});

test('only staff can issue approvals; tokens cannot be forged, transferred, expired or used for Open Gym', () => {
  const state = fixture(), approval = create(state);
  assert.throws(() => createCoachArrivalApproval(state, traineeId, { traineeId, reason: 'test' }, token, now), /מאמן/);
  assert.throws(() => coachExceptionChoices(approval.payload, 'partner', approval.code, now), /מיועד/);
  assert.throws(() => coachExceptionChoices(approval.payload, traineeId, COACH_EXCEPTION_PREFIX + 'forged', now));
  assert.throws(() => coachExceptionChoices(approval.payload, traineeId, approval.code, now + 600000), /פג תוקף/);
  assert.throws(() => redeemCoachArrivalApproval(approval.payload, traineeId, { ...redeem(), trainingType: 'OPEN_GYM' }, now));
  assert.throws(() => redeemCoachArrivalApproval(approval.payload, traineeId, { ...redeem(), targetId: 'different' }, now));
  assert.throws(() => redeemCoachArrivalApproval(approval.payload, traineeId, { ...redeem(), type: 'OPEN_GYM' }, now));
  assert.throws(() => createCoachArrivalApproval(state, 'coach', { traineeId: 'missing', reason: 'test' }, token, now), /למאגר/);
});

test('live approval still requires registration, payment, health and available card credit, including duo partner', () => {
  for (const update of [{ registrationIncomplete: true }, { registrationPaymentPending: true }, { membershipExpiry: '2026-10-01' }, { isMembershipFrozen: true }, { healthDeclarationSigned: false }, { personalTrainingRemaining: 0, duoTrainingRemaining: 0 }]) {
    const approval = create(fixture()); Object.assign(approval.payload.users[2], update);
    assert.throws(() => redeemCoachArrivalApproval(approval.payload, traineeId, redeem(), now));
  }
  const approval = create(fixture()); approval.payload.users[3].healthDeclarationSigned = false;
  assert.throws(() => redeemCoachArrivalApproval(approval.payload, traineeId, redeem('DUO'), now));
});

test('new code revokes pending old codes and an existing personal booking cannot be debited again', () => {
  const approval = create(fixture());
  const replacement = createCoachArrivalApproval(approval.payload, 'coach', { traineeId, reason: 'קוד חלופי' }, 'replacement-token', now);
  assert.throws(() => coachExceptionChoices(replacement.payload, traineeId, approval.code, now));
  approval.payload.sessions = [{ id: 'booked', date: '2026-10-06', time: '12:00', durationMinutes: 60, isPersonalTraining: true, registeredUsers: [traineeId] }];
  assert.throws(() => redeemCoachArrivalApproval(approval.payload, traineeId, redeem(), now), /ללא ניכוי נוסף/);
  assert.equal(approval.payload.users[2].personalTrainingRemaining, 6);
});

test('every exception scan is audited, including invalid tokens, and retry of same scan does not duplicate messages', () => {
  const approval = create(fixture()), input = { code: approval.code, scanId: 'test-scan-0001' };
  const scan = recordCoachExceptionScan(approval.payload, traineeId, input, now);
  assert.equal(scan.payload.messages.length, 2); assert.equal(scan.payload.users[2].personalTrainingRemaining, 6);
  assert.equal(recordCoachExceptionScan(scan.payload, traineeId, input, now).payload, scan.payload);
  const invalid = recordCoachExceptionScan(scan.payload, traineeId, { ...input, code: COACH_EXCEPTION_PREFIX + 'forged', scanId: 'test-scan-0002' }, now);
  assert.ok(invalid.error); assert.equal(invalid.payload.messages.length, 4);
});

test('historical staff reconciliation works without app completion, cannot create users or negative credit, requires date/reason/confirmation', () => {
  const state = fixture(); state.users[2].registrationIncomplete = true; state.users[2].healthDeclarationSigned = false;
  const input = { traineeId, eventId: 'historical-event-1', trainingType: 'SOLO', date: '2026-10-05', reason: 'האימון בוצע לפני התקנת האפליקציה', confirmDebit: true };
  const next = recordHistoricalCoachArrival(state, 'coach', input, now);
  assert.equal(next.users[2].personalTrainingRemaining, 5);
  assert.equal(next.attendanceLogs[0].historical, true); assert.equal(next.attendanceLogs[0].date, input.date);
  assert.equal(recordHistoricalCoachArrival(next, 'coach', input, now), next);
  for (const update of [{ confirmDebit: false }, { reason: '' }, { date: '2026-10-07' }, { date: '2026-02-30' }, { traineeId: 'missing' }]) assert.throws(() => recordHistoricalCoachArrival(state, 'coach', { ...input, ...update }, now));
  assert.throws(() => recordHistoricalCoachArrival(state, traineeId, input, now));
  state.users[2].personalTrainingRemaining = 0;
  assert.throws(() => recordHistoricalCoachArrival(state, 'coach', input, now), /אין יתרת/);
});

test('state sync cannot inject or erase approval tokens or forge/remove exception audit logs', () => {
  const approval = create(fixture());
  assert.deepEqual(payloadForUser(approval.payload, traineeId, 'TRAINEE').coachArrivalApprovals, []);
  for (const [id, role] of [[traineeId, 'TRAINEE'], ['coach', 'COACH'], ['manager', 'MANAGER']]) {
    const next = redeemCoachArrivalApproval(approval.payload, traineeId, redeem(), now);
    const forged = { ...next, coachArrivalApprovals: [{ token: 'forged', traineeId }], attendanceLogs: [{ ...next.attendanceLogs[0], id: 'arrival-exception-forged' }] };
    const merged = mergePayloadForUser(next, forged, id, role);
    assert.deepEqual(merged.coachArrivalApprovals, next.coachArrivalApprovals);
    assert.equal(merged.attendanceLogs.length, 1); assert.equal(merged.attendanceLogs[0].id, next.attendanceLogs[0].id);
    const demoSaved = preserveCoachArrivalAudit(next, { ...next, coachArrivalApprovals: [], attendanceLogs: [], messages: [] });
    assert.deepEqual(demoSaved.coachArrivalApprovals, next.coachArrivalApprovals);
    assert.deepEqual(demoSaved.attendanceLogs, next.attendanceLogs);
    assert.deepEqual(demoSaved.messages, next.messages);
  }
});

test('authenticated API restricts creation to staff, persists CAS retry and redeems once', async () => {
  const current = Date.now(); let state = { payload: fixture(), revision: 1 }, actor = 'coach', conflict = true;
  state.payload.users[2].membershipExpiry = '2099-11-01'; state.payload.users[2].healthDeclarationDate = clubDate(new Date(current)); state.payload.users[3].healthDeclarationDate = clubDate(new Date(current));
  const env = { STATE_STORE: { getSession: async () => ({ club_id: 'test', user_id: actor }), getAccount: async () => ({ user_id: actor, role: actor === 'coach' ? 'COACH' : 'TRAINEE' }), getClubState: async () => state, putClubState: async (_club, payload) => {
    if (conflict) { conflict = false; return { conflict: true }; }
    state = { payload, revision: state.revision + 1 }; return { conflict: false, revision: state.revision };
  } } };
  const post = (path, body) => worker.fetch(new Request('https://club.test' + path, { method: 'POST', headers: { Cookie: 'baly_session=test', 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), env);
  actor = traineeId;
  assert.equal((await post('/api/attendance/coach-exception', { action: 'CREATE', traineeId, reason: 'חריג' })).status, 403);
  actor = 'coach';
  const response = await post('/api/attendance/coach-exception', { action: 'CREATE', traineeId, reason: 'חריג' }); assert.equal(response.status, 200);
  const { code } = await response.json(); assert.equal(state.payload.coachArrivalApprovals.length, 1);
  actor = traineeId; conflict = true;
  const scan = await post('/api/attendance/arrival', { action: 'SCAN', code, scanId: 'api-exception-1' }); assert.equal(scan.status, 200);
  const choice = (await scan.json()).choices[0];
  const input = { ...choice, code, confirmUnscheduled: true };
  conflict = true;
  assert.equal((await post('/api/attendance/arrival', input)).status, 200);
  const repeated = await post('/api/attendance/arrival', input); assert.equal((await repeated.json()).alreadyRecorded, true);
  assert.equal(state.payload.users[2].personalTrainingRemaining, 5);
});
