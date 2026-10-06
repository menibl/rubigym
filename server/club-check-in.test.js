import test from 'node:test';
import assert from 'node:assert/strict';
import { clubArrivalChoices, recordClubArrival, clubArrivalResult, CLUB_CHECK_IN_CODE } from '../shared/club-check-in.js';
import { changePersonalBooking } from '../shared/personal-booking.js';
import worker from './index.js';
import { clubDate } from '../shared/membership-calendar.js';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { readFileSync } from 'node:fs';
import { mergePayloadForUser } from './auth.js';

const now = Date.parse('2026-10-05T09:15:00Z'); // 12:15 at the club
const fixture = () => ({
  settings: {}, messages: [], attendanceLogs: [],
  users: [{ id: 'u', name: 'מתאמן', role: 'TRAINEE', familyId: 'f', membershipType: 'OPEN_GYM',
    secondaryMemberships: ['PERSONAL_TRAINING', 'DUO_TRAINING'], membershipStatus: 'ACTIVE', membershipExpiry: '2026-11-01',
    healthDeclarationSigned: true, healthDeclarationDate: '2026-09-01', personalTrainingRemaining: 2, duoTrainingRemaining: 3 },
    { id: 'partner', name: 'בן משפחה', role: 'TRAINEE', familyId: 'f', familyPayerId: 'u', healthDeclarationSigned: true, healthDeclarationDate: '2026-09-01' }],
  sessions: [{ id: 's', title: 'אישי', date: '2026-10-05', time: '12:00', durationMinutes: 60, isPersonalTraining: true,
    registeredUsers: [], waitlistUsers: [], maxParticipants: 1, genderRestriction: 'ALL' }],
  openGymSessions: [{ id: 'o', date: '2026-10-05', timeSlot: '12:00-13:00', registeredUsers: [], waitlistUsers: [], maxParticipants: 10 }]
});
const input = (type = 'SOLO') => ({ code: CLUB_CHECK_IN_CODE, type: 'SESSION', targetId: 's', trainingType: type, partnerId: 'partner' });

test('success reports the saved solo balance and actual card size, without inventing missing size', () => {
  const state = fixture(); Object.assign(state.users[0], { personalTrainingRemaining: 6, personalTrainingCardSize: 10 });
  const next = recordClubArrival(state, 'u', input(), now);
  const result = clubArrivalResult(next, 'u', input());
  assert.equal(result.remaining, 5); assert.equal(result.cardSize, 10);
  assert.match(result.message, /נרשמת לאימון אישי.*5\/10/);
  assert.equal(clubArrivalResult(next, 'u', input(), true).remaining, 5);
  delete next.users[0].personalTrainingCardSize;
  assert.equal(clubArrivalResult(next, 'u', input()).cardSize, null);
});

test('duo partner sees payer balance and open welcomes without a card debit message', () => {
  const state = fixture(); state.users[0].duoTrainingCardSize = 10;
  let next = recordClubArrival(state, 'u', input('DUO'), now);
  next = recordClubArrival(next, 'partner', input('DUO'), now);
  const result = clubArrivalResult(next, 'partner', input('DUO'));
  assert.equal(result.remaining, 2); assert.equal(result.cardSize, 10);
  assert.match(result.message, /אימון זוגי.*בכרטיסייה של מתאמן.*2\/10/);
  const open = clubArrivalResult(state, 'u', { type: 'OPEN_GYM' });
  assert.match(open.message, /ברוך הבא למועדון, אימון נעים/);
  assert.equal(open.remaining, undefined);
});

test('multiple entitlements show open, solo and duo choices, including unbooked current sessions', () => {
  const choices = clubArrivalChoices(fixture(), 'u', now);
  assert.deepEqual(choices.map(c => c.trainingType), ['SOLO', 'DUO', 'OPEN_GYM']);
  assert.deepEqual(choices[1].partners, [{ id: 'partner', name: 'בן משפחה' }]);
});
test('arrival registers solo and debits once; repeats are a no-op', () => {
  const original = fixture();
  const next = recordClubArrival(original, 'u', input(), now);
  assert.equal(next.users[0].personalTrainingRemaining, 1);
  assert.equal(next.users[0].duoTrainingRemaining, 3);
  assert.deepEqual(next.sessions[0].registeredUsers, ['u']);
  assert.equal(next.attendanceLogs.length, 1);
  assert.equal(next.attendanceLogs[0].date, '2026-10-05');
  assert.equal(recordClubArrival(next, 'u', input(), now), next);
  assert.equal(original.users[0].personalTrainingRemaining, 2);
});
test('duo debits only payer duo card and registers both', () => {
  const next = recordClubArrival(fixture(), 'u', input('DUO'), now);
  assert.equal(next.users[0].duoTrainingRemaining, 2);
  assert.equal(next.users[0].personalTrainingRemaining, 2);
  assert.deepEqual(next.sessions[0].registeredUsers, ['u', 'partner']);
  assert.equal(recordClubArrival(next, 'partner', input('DUO'), now).users[0].duoTrainingRemaining, 2);
});
test('already booked personal attendance does not debit even with zero remaining', () => {
  let state = changePersonalBooking(fixture(), 'u', { action: 'BOOK', type: 'SOLO', sessionId: 's', bookingId: 'prior' }, now - 3600000);
  state.users[0].personalTrainingRemaining = 0;
  const next = recordClubArrival(state, 'u', input(), now);
  assert.equal(next.users[0].personalTrainingRemaining, 0);
});
test('open arrival is registration and documentation only', () => {
  const next = recordClubArrival(fixture(), 'u', { code: CLUB_CHECK_IN_CODE, type: 'OPEN_GYM', targetId: 'o', trainingType: 'OPEN_GYM' }, now);
  assert.deepEqual(next.openGymSessions[0].registeredUsers, ['u']);
  assert.equal(next.users[0].personalTrainingRemaining, 2);
  assert.equal(next.users[0].duoTrainingRemaining, 3);
  assert.equal(next.attendanceLogs[0].type, 'OPEN_GYM');
});
test('invalid code, no balance, wrong partner, expired/frozen/unpaid/health-invalid cannot register', () => {
  assert.throws(() => recordClubArrival(fixture(), 'u', { ...input(), code: 'wrong' }, now));
  assert.throws(() => recordClubArrival(fixture(), 'u', { ...input('DUO'), partnerId: 'other' }, now));
  for (const update of [{ personalTrainingRemaining: 0 }, { membershipExpiry: '2026-10-01' }, { isMembershipFrozen: true },
    { registrationPaymentPending: true }, { familyPaymentPending: true }, { healthDeclarationSigned: false }]) {
    const state = fixture(); Object.assign(state.users[0], update);
    assert.throws(() => recordClubArrival(state, 'u', input(), now));
  }
});
test('no future/past/full/other trainee sessions or open third booking', () => {
  const after = clubArrivalChoices(fixture(), 'u', now + 3 * 3600000);
  assert.ok(after.every(c => c.unscheduled));
  const state = fixture(); state.sessions[0].registeredUsers = ['partner'];
  state.openGymSessions[0].maxParticipants = 0;
  assert.deepEqual(clubArrivalChoices(state, 'u', now), []);
  const third = fixture(); third.openGymSessions.push(...['a', 'b'].map(id => ({ id, date: '2026-10-05', timeSlot: '06:00-07:00', registeredUsers: ['u'] })));
  assert.ok(!clubArrivalChoices(third, 'u', now).some(c => c.type === 'OPEN_GYM'));
});

test('without calendar slots, membership choices register and debit personal exactly once', () => {
  const state = fixture(); state.sessions = []; state.openGymSessions = [];
  const choices = clubArrivalChoices(state, 'u', now);
  assert.deepEqual(choices.map(c => c.trainingType), ['SOLO', 'DUO', 'OPEN_GYM']);
  const solo = choices[0];
  const request = { ...solo, code: CLUB_CHECK_IN_CODE, remaining: 999 };
  const next = recordClubArrival(state, 'u', request, now);
  assert.equal(next.users[0].personalTrainingRemaining, 1);
  assert.equal(next.users[0].duoTrainingRemaining, 3);
  assert.deepEqual(next.sessions, []);
  assert.equal(next.attendanceLogs[0].unscheduled, true);
  assert.equal(clubArrivalResult(next, 'u', request).remaining, 1);
  assert.equal(recordClubArrival(next, 'u', request, now + 60000), next);
  assert.equal(clubArrivalChoices(next, 'u', now + 60000).find(c => c.trainingType === 'SOLO').checkedIn, true);
});

test('single personal membership provides one automatic choice; zero balance provides none', () => {
  const state = fixture(); state.sessions = []; state.openGymSessions = [];
  Object.assign(state.users[0], { membershipType: 'PERSONAL_TRAINING', secondaryMemberships: [] });
  assert.deepEqual(clubArrivalChoices(state, 'u', now).map(c => c.trainingType), ['SOLO']);
  state.users[0].personalTrainingRemaining = 0;
  assert.deepEqual(clubArrivalChoices(state, 'u', now), []);
});

test('unscheduled duo records both participants and charges payer only; partner cannot debit again', () => {
  const state = fixture(); state.sessions = []; state.openGymSessions = [];
  const choice = clubArrivalChoices(state, 'u', now).find(c => c.trainingType === 'DUO');
  const request = { ...choice, code: CLUB_CHECK_IN_CODE, partnerId: 'partner' };
  assert.throws(() => recordClubArrival(state, 'u', { ...request, partnerId: 'other' }, now));
  const next = recordClubArrival(state, 'u', request, now);
  assert.equal(next.users[0].duoTrainingRemaining, 2);
  assert.equal(next.attendanceLogs.length, 2);
  assert.equal(next.attendanceLogs[1].traineeId, 'partner');
  assert.equal(clubArrivalResult(next, 'partner', request).remaining, 2);
  assert.equal(recordClubArrival(next, 'partner', request, now), next);
  assert.deepEqual(next.sessions, []);
});

test('unscheduled open documents only, respects daily cap, and cannot bypass full scheduled slot', () => {
  const state = fixture(); state.sessions = []; state.openGymSessions = [];
  const choice = clubArrivalChoices(state, 'u', now).find(c => c.trainingType === 'OPEN_GYM');
  const request = { ...choice, code: CLUB_CHECK_IN_CODE };
  const next = recordClubArrival(state, 'u', request, now);
  assert.equal(next.users[0].personalTrainingRemaining, 2);
  assert.deepEqual(next.openGymSessions, []);
  assert.equal(recordClubArrival(next, 'u', request, now), next);
  state.openGymSessions = ['a', 'b'].map(id => ({ id, date: '2026-10-05', timeSlot: '06:00-07:00', registeredUsers: ['u'] }));
  assert.ok(!clubArrivalChoices(state, 'u', now).some(c => c.trainingType === 'OPEN_GYM'));
  const full = fixture(); full.sessions = []; full.openGymSessions[0].maxParticipants = 0;
  assert.ok(!clubArrivalChoices(full, 'u', now).some(c => c.trainingType === 'OPEN_GYM'));
});

test('drop-in cannot bypass health/payment/freeze checks or an overlapping booking', () => {
  for (const update of [{ registrationPaymentPending: true }, { isMembershipFrozen: true }, { healthDeclarationSigned: false }, { membershipExpiry: '2026-10-01' }]) {
    const state = fixture(); state.sessions = []; state.openGymSessions = []; Object.assign(state.users[0], update);
    assert.throws(() => clubArrivalChoices(state, 'u', now));
  }
  const state = fixture(); state.sessions[0].isPersonalTraining = false; state.sessions[0].registeredUsers = ['u']; state.openGymSessions = [];
  assert.deepEqual(clubArrivalChoices(state, 'u', now).map(c => c.trainingType), ['GROUP']);
});

test('client state cannot forge drop-in attendance to avoid debit; persisted attendance survives sync', () => {
  const state = fixture(); state.sessions = []; state.openGymSessions = [];
  const choice = clubArrivalChoices(state, 'u', now).find(c => c.trainingType === 'SOLO');
  const fake = { traineeId: 'u', id: 'forged', type: 'SESSION', targetId: choice.targetId, date: '2026-10-05', unscheduled: true };
  const merged = mergePayloadForUser(state, { ...state, attendanceLogs: [fake, { ...fake, id: 'arrival-forged', unscheduled: false, targetId: 's' }] }, 'u', 'TRAINEE');
  assert.deepEqual(merged.attendanceLogs, []);
  const next = recordClubArrival(merged, 'u', { ...choice, code: CLUB_CHECK_IN_CODE }, now);
  const synced = mergePayloadForUser(next, state, 'u', 'TRAINEE');
  assert.equal(synced.attendanceLogs.length, 1);
  assert.equal(synced.users[0].personalTrainingRemaining, 1);
});

test('calendar registrations include unscheduled open attendance in daily limit', () => {
  const state = fixture(); state.sessions = []; state.openGymSessions = [];
  const choice = clubArrivalChoices(state, 'u', now).find(c => c.trainingType === 'OPEN_GYM');
  const next = recordClubArrival(state, 'u', { ...choice, code: CLUB_CHECK_IN_CODE }, now);
  next.openGymSessions = ['a', 'b'].map(id => ({ id, date: '2026-10-05', timeSlot: '18:00-19:00', registeredUsers: [], waitlistUsers: [], maxParticipants: 10 }));
  const incoming = { ...next, openGymSessions: next.openGymSessions.map(s => ({ ...s, registeredUsers: ['u'] })) };
  const merged = mergePayloadForUser(next, incoming, 'u', 'TRAINEE');
  assert.equal(merged.openGymSessions.filter(s => s.registeredUsers.includes('u')).length, 1);
});

test('open punch card debits once for unscheduled and scheduled arrival, never personal or duo', () => {
  for (const scheduled of [false, true]) {
    const state = fixture(); state.sessions = []; if (!scheduled) state.openGymSessions = [];
    Object.assign(state.users[0], { membershipType: 'OPEN_PUNCH_CARD', secondaryMemberships: [], punchCardRemaining: 3 });
    const choices = clubArrivalChoices(state, 'u', now);
    assert.deepEqual(choices.map(c => c.trainingType), ['OPEN_GYM']);
    const request = { ...choices[0], code: CLUB_CHECK_IN_CODE };
    const next = recordClubArrival(state, 'u', request, now);
    assert.equal(next.users[0].punchCardRemaining, 2);
    assert.equal(next.users[0].personalTrainingRemaining, 2); assert.equal(next.users[0].duoTrainingRemaining, 3);
    assert.equal(next.attendanceLogs[0].punchCardDebited, true);
    assert.match(clubArrivalResult(next, 'u', request).message, /יתרת כרטיסיית Open Gym: 2/);
    assert.equal(recordClubArrival(next, 'u', request, now), next);
    state.users[0].punchCardRemaining = 0;
    assert.deepEqual(clubArrivalChoices(state, 'u', now), []);
  }
});

test('included Open Gym takes precedence over punch card; preregistered open never debits again', () => {
  const state = fixture(); state.sessions = [];
  Object.assign(state.users[0], { membershipType: 'GROUP_MONTHLY', secondaryMemberships: ['OPEN_PUNCH_CARD'], punchCardRemaining: 3 });
  const choice = clubArrivalChoices(state, 'u', now)[0];
  const request = { ...choice, code: CLUB_CHECK_IN_CODE };
  assert.equal(recordClubArrival(state, 'u', request, now).users[0].punchCardRemaining, 3);
  state.users[0].membershipType = 'OPEN_PUNCH_CARD'; state.users[0].secondaryMemberships = []; state.users[0].punchCardRemaining = 0;
  state.openGymSessions[0].registeredUsers = ['u'];
  assert.equal(clubArrivalChoices(state, 'u', now)[0].registered, true);
  assert.equal(recordClubArrival(state, 'u', request, now).users[0].punchCardRemaining, 0);
  state.openGymSessions[0].registeredUsers = []; state.users[0].membershipType = undefined; state.users[0].punchCardRemaining = 3;
  assert.deepEqual(clubArrivalChoices(state, 'u', now), []);
});
test('normal booking still rejects a started session; only arrival path enables it', () => {
  assert.throws(() => changePersonalBooking(fixture(), 'u', { action: 'BOOK', type: 'SOLO', sessionId: 's', bookingId: 'id', arrival: true }, now));
});
test('camera fallback decodes the exact printed club QR, without BarcodeDetector support', () => {
  const qr = QRCode.create(CLUB_CHECK_IN_CODE, { errorCorrectionLevel: 'H' });
  const scale = 6, margin = 4, size = (qr.modules.size + margin * 2) * scale;
  const pixels = new Uint8ClampedArray(size * size * 4).fill(255);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const row = Math.floor(y / scale) - margin, column = Math.floor(x / scale) - margin;
    if (row >= 0 && column >= 0 && row < qr.modules.size && column < qr.modules.size && qr.modules.get(row, column)) {
      const offset = (y * size + x) * 4; pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = 0;
    }
  }
  assert.equal(jsQR(pixels, size, size).data, CLUB_CHECK_IN_CODE);
});
test('home avatar opens profile and scan shortcut precedes action tiles; no simulated check-in bypass', () => {
  const home = readFileSync(new URL('../src/components/RoleWorkspaceLanding.tsx', import.meta.url), 'utf8');
  assert.match(home, /onClick=\{onOpenProfile\} aria-label="עריכת הפרופיל ושינוי תמונת הפרופיל"/);
  assert.ok(home.indexOf('className="check-in-home-strip"') < home.indexOf('className="role-home-actions"'));
  const dashboard = readFileSync(new URL('../src/components/TraineeDashboard.tsx', import.meta.url), 'utf8');
  assert.match(dashboard, /<ClubArrivalScanner/);
  assert.doesNotMatch(dashboard, /handleSimulateCheckIn|אישור סריקת בדיקה/);
});
test('arrival API authenticates and retries revision conflict without double debit', async () => {
  let state = { payload: fixture(), revision: 1 };
  const realNow = new Date();
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(realNow).map(p => [p.type, p.value]));
  state.payload.sessions[0].date = clubDate(realNow); state.payload.sessions[0].time = `${parts.hour}:${parts.minute}`;
  state.payload.users[0].membershipExpiry = '2099-11-01'; state.payload.users[0].healthDeclarationDate = clubDate(realNow);
  let conflict = true;
  const env = { CLUB_ID: 'test', STATE_STORE: {
    getSession: async () => ({ club_id: 'test', user_id: 'u' }), getAccount: async () => ({ user_id: 'u', role: 'TRAINEE' }),
    getClubState: async () => state, putClubState: async (_id, payload, revision) => {
      assert.equal(revision, state.revision);
      if (conflict) { conflict = false; return { conflict: true }; }
      state = { payload, revision: state.revision + 1 }; return { conflict: false };
    }
  } };
  const post = (authenticated, body = input()) => worker.fetch(new Request('https://club.test/api/attendance/arrival', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(authenticated ? { Cookie: 'baly_session=test' } : {}) }, body: JSON.stringify(body)
  }), env);
  assert.equal((await post(false)).status, 401);
  const response = await post(true); assert.equal(response.status, 200);
  const result = await response.json(); assert.equal(result.remaining, 1); assert.match(result.message, /אימון אישי/);
  const repeat = await post(true); assert.equal(repeat.status, 200);
  const repeatedResult = await repeat.json(); assert.equal(repeatedResult.remaining, 1); assert.equal(repeatedResult.alreadyRecorded, true);
  assert.equal(state.payload.users[0].personalTrainingRemaining, 1);
  assert.equal(state.payload.attendanceLogs.length, 1);
  state.payload.sessions = []; state.payload.openGymSessions = []; conflict = true;
  const choice = clubArrivalChoices(state.payload, 'u').find(c => c.trainingType === 'SOLO');
  const body = { ...choice, code: CLUB_CHECK_IN_CODE };
  const dropIn = await post(true, body); assert.equal(dropIn.status, 200);
  assert.equal((await dropIn.json()).remaining, 0);
  assert.equal((await post(true, body)).status, 200);
  assert.equal(state.payload.users[0].personalTrainingRemaining, 0);
  assert.deepEqual(state.payload.sessions, []);
  assert.equal(state.payload.attendanceLogs.length, 2);
  Object.assign(state.payload.users[0], { membershipType: 'OPEN_PUNCH_CARD', secondaryMemberships: [], punchCardRemaining: 3 });
  conflict = true;
  const open = clubArrivalChoices(state.payload, 'u').find(c => c.trainingType === 'OPEN_GYM');
  const openBody = { ...open, code: CLUB_CHECK_IN_CODE };
  const openResponse = await post(true, openBody); assert.equal(openResponse.status, 200);
  assert.equal((await openResponse.json()).remaining, 2);
  assert.equal((await post(true, openBody)).status, 200);
  assert.equal(state.payload.users[0].punchCardRemaining, 2);
});
