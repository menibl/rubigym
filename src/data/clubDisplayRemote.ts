import { GroupWorkoutProgram } from '../types';

const apiBase = () => (import.meta.env.VITE_PAYMENT_API_URL || '').replace(/\/$/, '');

export const clubDisplayUrl = () => `${window.location.origin}${window.location.pathname}#club-workout-display`;

export const activateClubDisplay = async (program: GroupWorkoutProgram) => {
  const base = apiBase();
  if (!base) throw new Error('שרת התצוגה עדיין לא הוגדר.');
  const response = await fetch(`${base}/api/live-display/active`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ program })
  });
  if (!response.ok) throw new Error('לא ניתן לעדכן את מסך המועדון.');
};
export const getActiveClubDisplay = async (): Promise<GroupWorkoutProgram | undefined> => {
  const base = apiBase();
  if (!base) return undefined;
  const response = await fetch(`${base}/api/live-display/active`, { cache: 'no-store' });
  if (response.status === 204 || response.status === 404) return undefined;
  if (!response.ok) throw new Error('מסך המועדון אינו זמין כרגע.');
  const result = await response.json();
  return result.program as GroupWorkoutProgram | undefined;
};
