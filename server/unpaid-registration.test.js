import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './index.js';
import { createPhoneVerificationToken } from './sms-auth.js';
import { mergePayloadForUser } from './auth.js';
import { unpaidRegistration, completedLegacyRegistration } from '../shared/registration-status.js';

test('unpaid profile can register, log in with password and load the app without a payment', async () => {
  let state = { payload: { users: [], payments: [], messages: [] }, revision: 1 };
  let account;
  const sessions = new Map();
  const store = {
    async getClubState() { return state; },
    async putClubState(_club, payload) { state = { payload, revision: state.revision + 1 }; return { revision: state.revision }; },
    async upsertAccount(value) { account = { user_id: value.userId, role: value.role, profile: value.profile, password_hash: value.passwordHash }; },
    async getAccountByLogin() { return account || null; },
    async getAccount() { return account; },
    async createSession(token, club, user) { sessions.set(token, { club_id: club, user_id: user }); },
    async getSession(token) { return sessions.get(token); }
  };
  const env = { STATE_STORE: store, CLUB_ID: 'test', SMS_OTP_SIGNING_SECRET: 'unpaid-registration-test-secret-long-enough' };
  const user = { id: 'trainee', name: 'Test', username: 'test-user', password: 'password-123', email: 'test@example.com', phone: '0541234567', role: 'TRAINEE', membershipStatus: 'ACTIVE', nutritionPlanPaid: true, personalTrainingRemaining: 12 };
  const token = await createPhoneVerificationToken({ env, clubId: 'test', phone: user.phone });
  const post = (path, body) => worker.fetch(new Request(`https://club.test/api/auth/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), env);
  const response = await post('register', { user, phoneVerificationToken: token });
  assert.equal(response.status, 201);
  const saved = (await response.json()).user;
  assert.equal(saved.registrationIncomplete, false);
  assert.equal(saved.registrationPaymentPending, true);
  assert.equal(saved.membershipStatus, 'DEBT');
  assert.equal(saved.nutritionPlanPaid, false);
  assert.equal(saved.personalTrainingRemaining, 0);
  assert.equal(state.payload.payments.length, 0);
  assert.equal(account.profile.registrationPaymentPending, true);
  const login = await post('login', { login: 'test-user', password: user.password });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('Set-Cookie').split(';')[0];
  const app = await worker.fetch(new Request('https://club.test/api/state', { headers: { Cookie: cookie } }), env);
  assert.equal(app.status, 200);
  // Existing completed profiles stuck with the old flag recover during login, without a new account.
  state.payload.users[0] = { ...saved, registrationIncomplete: true, birthDate: '1990-01-01', clubAgreementSigned: true };
  const recovered = await post('login', { login: 'test-user', password: user.password });
  assert.equal(recovered.status, 200);
  assert.equal((await recovered.json()).user.registrationIncomplete, false);
  assert.equal(state.payload.users.length, 1);
  assert.equal(state.payload.users[0].membershipStatus, 'DEBT');
});

test('unpaid accounts cannot grant themselves bookings, open gym or attendance', () => {
  const user = unpaidRegistration({ id: 'u', role: 'TRAINEE' });
  const current = { users: [user], sessions: [{ id: 's', registeredUsers: [] }], openGymSessions: [{ id: 'o', registeredUsers: [] }], messages: [], attendanceLogs: [] };
  const incoming = { ...current, users: [{ ...user, membershipStatus: 'ACTIVE', registrationPaymentPending: false }], sessions: [{ id: 's', registeredUsers: ['u'] }], openGymSessions: [{ id: 'o', registeredUsers: ['u'] }], attendanceLogs: [{ id: 'a', traineeId: 'u' }] };
  const merged = mergePayloadForUser(current, incoming, 'u', 'TRAINEE');
  assert.deepEqual(merged.sessions, current.sessions);
  assert.deepEqual(merged.openGymSessions, current.openGymSessions);
  assert.equal(merged.attendanceLogs.length, 0);
  assert.equal(merged.users[0].registrationPaymentPending, true);
});

test('legacy recovery requires complete details and does not promote phone-only placeholders', () => {
  assert.equal(completedLegacyRegistration({ registrationIncomplete: true, name: 'הרשמה בתהליך', phone: '0541234567' }), false);
  assert.equal(completedLegacyRegistration({ registrationIncomplete: true, name: 'Test', username: 'test', email: 'test@example.com', birthDate: '1990-01-01', clubAgreementSigned: true }), true);
});
