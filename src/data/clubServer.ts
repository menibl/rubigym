import { Payment, User } from '../types';
import { isPagesDemoMode } from './appMode';
import { createDemoPayload } from './demoData';

const DEMO_STATE_KEY = 'baly_pages_demo_state_v1';
const DEMO_SESSION_KEY = 'baly_pages_demo_session_v1';
const DEMO_PASSWORDS_KEY = 'baly_pages_demo_passwords_v1';

type DemoState = ClubStateEnvelope;

const normalizeLogin = (value: string) => value.trim().toLowerCase().replace(/[^\p{L}\p{N}@.+]/gu, '');

const readDemoState = (): DemoState => {
  try {
    const stored = localStorage.getItem(DEMO_STATE_KEY);
    if (stored) return JSON.parse(stored) as DemoState;
  } catch { /* start again from the public demo seed */ }
  const state = { payload: createDemoPayload(), revision: 1 };
  localStorage.setItem(DEMO_STATE_KEY, JSON.stringify(state));
  return state;
};

const writeDemoState = (state: DemoState) => {
  localStorage.setItem(DEMO_STATE_KEY, JSON.stringify(state));
  return state;
};

const demoPasswords = (): Record<string, string> => {
  try { return JSON.parse(localStorage.getItem(DEMO_PASSWORDS_KEY) || '{}'); }
  catch { return {}; }
};

const findDemoUser = (login: string) => {
  const normalized = normalizeLogin(login);
  return ((readDemoState().payload.users as User[]) || []).find(user =>
    [user.name, user.username, user.email, user.phone].filter(Boolean).some(value => normalizeLogin(String(value)) === normalized)
  );
};

const currentDemoUser = () => {
  const id = localStorage.getItem(DEMO_SESSION_KEY);
  return id ? ((readDemoState().payload.users as User[]) || []).find(user => user.id === id) : undefined;
};

const apiBase = () => (import.meta.env.VITE_API_URL || import.meta.env.VITE_AI_API_URL || import.meta.env.VITE_PAYMENT_API_URL || '').replace(/\/$/, '');

const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const response = await fetch(`${apiBase()}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) }
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const fallback = response.status === 409
      ? 'STATE_CONFLICT'
      : response.status === 413
        ? 'השינוי גדול ממגבלת השמירה של השרת. יש לפנות למנהל המערכת.'
        : 'שירות המועדון אינו זמין כרגע.';
    const serverMessage = result.message === 'Request too large' ? fallback : result.message;
    const error = new Error(serverMessage || fallback) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return result as T;
};

export type ClubStateEnvelope = { payload: Record<string, unknown>; revision: number; updated_at?: string };

export const getServerSession = async () => {
  if (isPagesDemoMode()) {
    const user = currentDemoUser();
    if (!user) throw new Error('DEMO_SESSION_NOT_FOUND');
    return { authenticated: true, user };
  }
  return request<{ authenticated: boolean; user: User }>('/api/auth/session');
};

export type PasswordLoginResult = { user: User } | {
  requiresSmsVerification: true;
  maskedPhone: string;
  expiresInSeconds: number;
  testMode?: boolean;
};

export const loginWithPassword = async (login: string, password: string, otp = ''): Promise<PasswordLoginResult> => {
  if (isPagesDemoMode()) {
    const user = findDemoUser(login);
    const passwords = demoPasswords();
    const expected = passwords[user?.id || ''] || (user?.id === 'user-robi' ? import.meta.env.VITE_DEMO_MANAGER_PASSWORD : '');
    if (!user || !expected || password !== expected) throw new Error('שם המשתמש או הסיסמה אינם נכונים.');
    if (!otp) return { requiresSmsVerification: true, maskedPhone: `***-***-${String(user.phone || '').replace(/\D/g, '').slice(-4)}`, expiresInSeconds: 300, testMode: true };
    if (otp !== '1111') throw new Error('קוד האימות אינו תקין או שפג תוקפו.');
    localStorage.setItem(DEMO_SESSION_KEY, user.id);
    return { user };
  }
  return request<PasswordLoginResult>('/api/auth/login', { method: 'POST', body: JSON.stringify({ login, password, otp: otp || undefined }) });
};

export const loginWithPhone = async (phone: string, otp: string) => {
  if (isPagesDemoMode()) {
    const user = findDemoUser(phone);
    if (!user || otp !== '1111') throw new Error('מספר הטלפון או קוד האימות אינם תקינים.');
    localStorage.setItem(DEMO_SESSION_KEY, user.id);
    return { user };
  }
  return request<{ user: User }>('/api/auth/phone-login', { method: 'POST', body: JSON.stringify({ phone, otp }) });
};

export type PhoneCodeRequestResult =
  | { ok: true; expiresInSeconds: number; testMode?: boolean }
  | { ok: false; registrationRequired: true };

export const requestPhoneCode = async (phone: string, purpose: 'LOGIN' | 'REGISTER'): Promise<PhoneCodeRequestResult> => {
  if (isPagesDemoMode()) {
    if (purpose === 'LOGIN' && !findDemoUser(phone)) return { ok: false, registrationRequired: true };
    return { ok: true, expiresInSeconds: 300, testMode: true };
  }
  return request<PhoneCodeRequestResult>('/api/auth/request-phone-code', {
    method: 'POST',
    body: JSON.stringify({ phone, purpose })
  });
};

export const verifyRegistrationPhone = async (phone: string, otp: string) => {
  if (isPagesDemoMode()) {
    if (otp !== '1111') throw new Error('קוד האימות אינו תקין או שפג תוקפו.');
    return { verified: true as const, phoneVerificationToken: 'pages-demo' };
  }
  return request<{ verified: true; phoneVerificationToken: string }>('/api/auth/verify-registration-phone', {
    method: 'POST',
    body: JSON.stringify({ phone, otp })
  });
};

export const registerServerUser = async (user: User, payment: Payment, familyUsers: User[] = [], phoneVerificationToken = '') => {
  if (isPagesDemoMode()) {
    const state = readDemoState();
    const users = (state.payload.users as User[]) || [];
    const registrations = [user, ...familyUsers];
    const identities = registrations.flatMap(candidate => [candidate.username, candidate.email, candidate.phone].filter(Boolean).map(value => normalizeLogin(String(value))));
    if (new Set(identities).size !== identities.length || users.some(candidate => [candidate.username, candidate.email, candidate.phone].filter(Boolean).some(value => identities.includes(normalizeLogin(String(value)))))) {
      throw new Error('שם המשתמש, האימייל או הטלפון כבר רשומים.');
    }
    const passwords = demoPasswords();
    registrations.forEach(candidate => { passwords[candidate.id] = candidate.password || ''; });
    localStorage.setItem(DEMO_PASSWORDS_KEY, JSON.stringify(passwords));
    const { password: _password, ...safeUser } = user;
    const safeFamilyUsers = familyUsers.map(({ password: _familyPassword, ...candidate }) => candidate as User);
    const next = writeDemoState({
      payload: { ...state.payload, users: [safeUser, ...safeFamilyUsers, ...users], payments: [payment, ...((state.payload.payments as Payment[]) || [])] },
      revision: state.revision + 1
    });
    localStorage.setItem(DEMO_SESSION_KEY, safeUser.id);
    return { user: safeUser as User, familyUsers: safeFamilyUsers, revision: next.revision };
  }
  return request<{ user: User; familyUsers: User[]; revision: number }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ user, payment, familyUsers, phoneVerificationToken })
  });
};

export const registerFamilyMember = async (user: User) => {
  if (isPagesDemoMode()) {
    const state = readDemoState();
    const users = (state.payload.users as User[]) || [];
    const identities = [user.username, user.email, user.phone].filter(Boolean).map(value => normalizeLogin(String(value)));
    if (users.some(candidate => [candidate.username, candidate.email, candidate.phone].filter(Boolean).some(value => identities.includes(normalizeLogin(String(value)))))) {
      throw new Error('שם המשתמש, האימייל או הטלפון כבר רשומים.');
    }
    const passwords = demoPasswords();
    passwords[user.id] = user.password || '';
    localStorage.setItem(DEMO_PASSWORDS_KEY, JSON.stringify(passwords));
    const { password: _password, ...safeUser } = user;
    const next = writeDemoState({ payload: { ...state.payload, users: [safeUser, ...users] }, revision: state.revision + 1 });
    return { user: safeUser as User, revision: next.revision };
  }
  return request<{ user: User; revision: number }>('/api/auth/family-members', { method: 'POST', body: JSON.stringify({ user }) });
};

export const logoutServerSession = async () => {
  if (isPagesDemoMode()) {
    localStorage.removeItem(DEMO_SESSION_KEY);
    return { ok: true };
  }
  return request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
};

export const updateServerPassword = async (password: string) => {
  if (isPagesDemoMode()) {
    const user = currentDemoUser();
    if (!user) throw new Error('DEMO_SESSION_NOT_FOUND');
    localStorage.setItem(DEMO_PASSWORDS_KEY, JSON.stringify({ ...demoPasswords(), [user.id]: password }));
    return { ok: true };
  }
  return request<{ ok: boolean }>('/api/auth/password', { method: 'PUT', body: JSON.stringify({ password }) });
};

const urlBase64ToBytes = (value: string) => {
  const padded = `${value}${'='.repeat((4 - value.length % 4) % 4)}`.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(padded), character => character.charCodeAt(0));
};

export const syncServerPushSubscription = async (enabled: boolean) => {
  if (isPagesDemoMode() || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return {supported: false, subscribed: false, endpoint: undefined};
  }

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();

  if (!enabled) {
    if (existing) {
      await request<{ok: boolean}>('/api/push/subscriptions', {
        method: 'DELETE',
        body: JSON.stringify({endpoint: existing.endpoint}),
      });
      await existing.unsubscribe();
    }
    return {supported: true, subscribed: false, endpoint: undefined};
  }

  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return {supported: true, subscribed: false, endpoint: undefined};
  }

  const {publicKey} = await request<{publicKey: string}>('/api/push/public-key');
  const subscription = existing || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToBytes(publicKey),
  });
  await request<{ok: boolean}>('/api/push/subscriptions', {
    method: 'POST',
    body: JSON.stringify(subscription.toJSON()),
  });
  return {supported: true, subscribed: true, endpoint: subscription.endpoint};
};

export const sendPushTest = async (subscription: PushSubscription) => {
  if (isPagesDemoMode()) return {ok: false, sent: 0};
  return request<{ok: boolean; sent: number}>('/api/push/test', {
    method: 'POST',
    body: JSON.stringify(subscription.toJSON())
  });
};

export const getClubState = async () => isPagesDemoMode() ? readDemoState() : request<ClubStateEnvelope>('/api/state');

export const saveClubState = async (payload: Record<string, unknown>, expectedRevision: number) => {
  if (isPagesDemoMode()) {
    const current = readDemoState();
    if (current.revision !== expectedRevision) {
      const error = new Error('STATE_CONFLICT') as Error & { status?: number };
      error.status = 409;
      throw error;
    }
    const next = writeDemoState({ payload, revision: current.revision + 1 });
    return { revision: next.revision };
  }
  return request<{ revision: number; generatedMessages?: import('../types').Message[] }>('/api/state', { method: 'PUT', body: JSON.stringify({ payload, expectedRevision }) });
};
