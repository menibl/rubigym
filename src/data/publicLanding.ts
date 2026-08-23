import { MembershipPlanConfig } from '../types';
import { isPagesDemoMode } from './appMode';

export type PublicLandingConfig = {
  surface: 'app' | 'landing';
  appUrl: string;
  landingUrl: string;
  plans: MembershipPlanConfig[];
  images: {
    hero: string | null;
    coaching: string | null;
  };
};

export type LandingImageSlot = 'hero' | 'coaching';

const apiBase = () => (import.meta.env.VITE_API_URL || import.meta.env.VITE_AI_API_URL || import.meta.env.VITE_PAYMENT_API_URL || '').replace(/\/$/, '');

const localConfig = (): PublicLandingConfig => {
  const url = new URL(window.location.href);
  const explicitSurface = url.searchParams.get('surface');
  const surface = explicitSurface === 'landing' || (explicitSurface !== 'app' && (isPagesDemoMode() || /\/landing\/?$/.test(url.pathname)))
    ? 'landing'
    : 'app';
  const appUrl = new URL(import.meta.env.BASE_URL, window.location.origin);
  appUrl.searchParams.set('surface', 'app');
  return {
    surface,
    appUrl: appUrl.toString(),
    landingUrl: surface === 'landing' ? window.location.href : '',
    plans: [],
    images: { hero: null, coaching: null }
  };
};

const readJson = async <T>(response: Response): Promise<T> => {
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((result as { message?: string }).message || 'שירות דף הנחיתה אינו זמין כרגע.');
  return result as T;
};

export const getPublicLandingConfig = async (): Promise<PublicLandingConfig> => {
  if (isPagesDemoMode()) return localConfig();
  const preview = /\/landing\/?$/.test(window.location.pathname) ? '?surface=landing' : '';
  try {
    const response = await fetch(`${window.location.origin}/api/public/landing${preview}`, { credentials: 'include' });
    const config = await readJson<PublicLandingConfig>(response);
    if (!['app', 'landing'].includes(config.surface) || !config.images || !Array.isArray(config.plans)) {
      throw new Error('Invalid public landing configuration');
    }
    return config;
  } catch {
    return localConfig();
  }
};

export const uploadLandingImage = async (slot: LandingImageSlot, image: Blob) => {
  const response = await fetch(`${apiBase()}/api/landing-media/${slot}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': image.type },
    body: image
  });
  return readJson<{ ok: true; slot: LandingImageSlot; size: number; updatedAt: string }>(response);
};

export const resetLandingImage = async (slot: LandingImageSlot) => {
  const response = await fetch(`${apiBase()}/api/landing-media/${slot}`, {
    method: 'DELETE',
    credentials: 'include'
  });
  return readJson<{ ok: true; slot: LandingImageSlot }>(response);
};
