import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './index.js';
import { accountFromUser, normalizePhone, verifyPassword } from './auth.js';
import { normalizeIsraeliMobile } from './sms-auth.js';

const pending = () => ({ id: 'pending', name: 'הרשמה בתהליך', username: 'registration-0541234567',
  phone: '0541234567', email: '', role: 'TRAINEE', membershipStatus: 'DEBT', registrationIncomplete: true });

const harness = async (user, withAccount = true) => {
  let state = { payload: { users: [user], payments: [], messages: [], sessions: [{ id: 's', registeredUsers: [] }] }, revision: 1 };
  const accounts = new Map();
  const sessions = new Map();
  const challenges = [];
  const persistAccount = a => accounts.set(a.userId, {
    user_id: a.userId, role: a.role, profile: a.profile, phone_normalized: a.phone,
    username_normalized: a.username, email_normalized: a.email, password_hash: a.passwordHash
  });
  if (withAccount) persistAccount(await accountFromUser('club', user, 'initial-password'));
  const store = {
    getClubState: async () => state,
    putClubState: async (_club, payload, revision) => {
      if (revision !== state.revision) return { conflict: true };
      state = { payload, revision: revision + 1 }; return { revision: state.revision };
    },
    getAccountByLogin: async (_club, login) => [...accounts.values()].find(a =>
      a.username_normalized === login || a.email_normalized === login || a.phone_normalized === normalizePhone(login)) || null,
    getAccount: async (_club, id) => accounts.get(id),
    listAccounts: async () => [...accounts.values()],
    upsertAccount: async a => persistAccount(a),
    updateAccountIdentity: async (_club, u) => {
      const a = accounts.get(u.id);
      if (a) accounts.set(u.id, { ...a, profile: u, phone_normalized: normalizePhone(u.phone) });
    },
    createSession: async (token, club, id) => sessions.set(token, { club_id: club, user_id: id }),
    getSession: async token => sessions.get(token),
    getOtpRequestStats: async () => ({ requestsLastHour: 0 }),
    createOtpChallenge: async c => challenges.push({ ...c, max_attempts: c.maxAttempts, expires_at: c.expiresAt, attempts: 0 }),
    getLatestOtpChallenge: async (_club, phone, purpose) => challenges.findLast(c => c.phone === phone && c.purpose === purpose),
    consumeOtpChallenge: async (id, hash) => {
      const c = challenges.find(c => c.id === id);
      if (c.consumed_at || c.codeHash !== hash) return false;
      c.consumed_at = new Date(); return true;
    }
  };
  const env = { CLUB_ID: 'club', STATE_STORE: store, SMS_TEST_MODE: 'true', SMS_OTP_SIGNING_SECRET: 'registration-resume-test-signing-secret' };
  const call = (path, body, cookie = '') => worker.fetch(new Request(`https://club.test/api/${path}`, {
    method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  }), env);
  const phoneLogin = async (phone = user.phone) => {
    const code = await call('auth/request-phone-code', { phone, purpose: 'LOGIN' });
    assert.equal(code.status, 202, await code.text());
    return call('auth/phone-login', { phone, otp: '1111' });
  };
  return { call, phoneLogin, accounts, state: () => state, challenges };
};

test('existing partial account can resume by SMS, retain a session and complete without payment or duplicate identity', async () => {
  const h = await harness(pending());
  const restart = await h.call('auth/request-phone-code', { phone: '+972541234567', purpose: 'REGISTER' });
  assert.deepEqual(await restart.json(), { ok: false, loginRequired: true });
  assert.equal(h.challenges.length, 0);
  const login = await h.phoneLogin('+972541234567');
  assert.equal(login.status, 200);
  const user = (await login.json()).user;
  assert.equal(user.id, 'pending');
  assert.equal(user.registrationIncomplete, true);
  const cookie = login.headers.get('Set-Cookie').split(';')[0];
  // Completing details is allowed even though the full club state is still blocked.
  assert.equal((await h.call('auth/session', null, cookie)).status, 200);
  assert.equal((await h.call('state', null, cookie)).status, 401);
  const complete = await h.call('auth/register', { user: { ...user, name: 'Test Trainee', username: 'test-trainee',
    email: 'trainee@example.com', birthDate: '1990-01-01', clubAgreementSigned: true, password: 'completed-password' } }, cookie);
  assert.equal(complete.status, 201, await complete.clone().text());
  const saved = (await complete.json()).user;
  assert.equal(saved.registrationIncomplete, false);
  assert.equal(saved.registrationPaymentPending, true);
  assert.equal(saved.membershipStatus, 'DEBT');
  assert.equal(h.state().payload.users.length, 1);
  assert.equal(h.accounts.size, 1);
  assert.equal(h.state().payload.payments.length, 0);
  const completeCookie = complete.headers.get('Set-Cookie').split(';')[0];
  assert.equal((await h.call('state', null, completeCookie)).status, 200);
  const passwordLogin = await h.call('auth/login', { login: 'test-trainee', password: 'completed-password' });
  assert.equal(passwordLogin.status, 200);
  assert.equal((await passwordLogin.json()).user.registrationPaymentPending, true);
});

test('legacy partial profile missing its login account recovers only after correct SMS', async () => {
  const h = await harness(pending(), false);
  await h.call('auth/request-phone-code', { phone: '0541234567', purpose: 'LOGIN' });
  const wrong = await h.call('auth/phone-login', { phone: '0541234567', otp: '2222' });
  assert.equal(wrong.status, 401);
  assert.equal(h.accounts.size, 0);
  const resumed = await h.call('auth/phone-login', { phone: '0541234567', otp: '1111' });
  assert.equal(resumed.status, 200);
  assert.equal((await resumed.json()).user.id, 'pending');
  assert.equal(h.accounts.size, 1);
  assert.equal(h.state().payload.users.length, 1);
  assert.equal(h.state().payload.users[0].membershipStatus, 'DEBT');
});

test('legacy full details with incomplete flag enter the app with payment pending', async () => {
  const user = { ...pending(), name: 'Test Trainee', username: 'test-trainee', email: 'trainee@example.com',
    birthDate: '1990-01-01', clubAgreementSigned: true };
  const h = await harness(user, false);
  const login = await h.phoneLogin();
  assert.equal(login.status, 200);
  const saved = (await login.json()).user;
  assert.equal(saved.registrationIncomplete, false);
  assert.equal(saved.registrationPaymentPending, true);
  assert.equal(saved.membershipStatus, 'DEBT');
  assert.equal(h.state().payload.users.length, 1);
  const cookie = login.headers.get('Set-Cookie').split(';')[0];
  assert.equal((await h.call('state', null, cookie)).status, 200);
});

test('unknown and deleted phones require fresh registration', async () => {
  const h = await harness(pending(), false);
  const response = await h.call('auth/request-phone-code', { phone: '0509999999', purpose: 'LOGIN' });
  assert.deepEqual(await response.json(), { ok: false, registrationRequired: true });
  assert.equal(h.accounts.size, 0);
  h.state().payload.deletedUserIds = ['pending'];
  const deleted = await h.call('auth/request-phone-code', { phone: '0541234567', purpose: 'LOGIN' });
  assert.deepEqual(await deleted.json(), { ok: false, registrationRequired: true });
});

test('repairing a stale phone index preserves the original password', async () => {
  const h = await harness({ ...pending(), phone: '+972541234567' });
  // This account has an international phone index; club profile still identifies
  // the exact user after verification of the normalized local phone.
  assert.equal(normalizeIsraeliMobile(h.state().payload.users[0].phone), '0541234567');
  const login = await h.phoneLogin();
  assert.equal(login.status, 200);
  assert.equal(await verifyPassword('initial-password', h.accounts.get('pending').password_hash), true);
  assert.equal(h.accounts.get('pending').phone_normalized, '972541234567');
  assert.equal(h.accounts.size, 1);
});
