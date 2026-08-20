import { Payment, User } from '../types';

const apiBase = () => (import.meta.env.VITE_API_URL || import.meta.env.VITE_AI_API_URL || import.meta.env.VITE_PAYMENT_API_URL || '').replace(/\/$/, '');

const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const response = await fetch(`${apiBase()}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) }
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.message || (response.status === 409 ? 'STATE_CONFLICT' : 'שירות המועדון אינו זמין כרגע.')) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return result as T;
};

export type ClubStateEnvelope = { payload: Record<string, unknown>; revision: number; updated_at?: string };

export const getServerSession = () => request<{ authenticated: boolean; user: User }>('/api/auth/session');
export const loginWithPassword = (login: string, password: string) => request<{ user: User }>('/api/auth/login', {
  method: 'POST', body: JSON.stringify({ login, password })
});
export const loginWithPhone = (phone: string, otp: string) => request<{ user: User }>('/api/auth/phone-login', {
  method: 'POST', body: JSON.stringify({ phone, otp })
});
export const registerServerUser = (user: User, payment: Payment) => request<{ user: User; revision: number }>('/api/auth/register', {
  method: 'POST', body: JSON.stringify({ user, payment })
});
export const logoutServerSession = () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
export const updateServerPassword = (password: string) => request<{ ok: boolean }>('/api/auth/password', {
  method: 'PUT', body: JSON.stringify({ password })
});
export const getClubState = () => request<ClubStateEnvelope>('/api/state');
export const saveClubState = (payload: Record<string, unknown>, expectedRevision: number) => request<{ revision: number }>('/api/state', {
  method: 'PUT', body: JSON.stringify({ payload, expectedRevision })
});
