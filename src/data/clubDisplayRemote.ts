import { GroupWorkoutProgram } from '../types';
import { isPagesDemoMode } from './appMode';

const apiBase = () => (
  import.meta.env.VITE_LIVE_DISPLAY_API_URL
  || import.meta.env.VITE_PAYMENT_API_URL
  || (isPagesDemoMode() ? 'https://balywellness.com' : '')
).replace(/\/$/, '');

const apiPath = () => isPagesDemoMode() ? '/api/demo/live-display' : '/api/live-display';

export const clubDisplayUrl = () => import.meta.env.BASE_URL === '/'
  ? `${window.location.origin}/tv`
  : `${window.location.origin}${import.meta.env.BASE_URL}tv.html`;

export const activateClubDisplay = async (program: GroupWorkoutProgram) => {
  const base = apiBase();
  if (!base) throw new Error('שרת התצוגה עדיין לא הוגדר.');
  const response = await fetch(`${base}${apiPath()}/active`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ program })
  });
  if (!response.ok) throw new Error('לא ניתן לעדכן את מסך המועדון.');
};
export const getActiveClubDisplay = async (): Promise<GroupWorkoutProgram | undefined> => {
  const base = apiBase();
  if (!base) return undefined;
  const response = await fetch(`${base}${apiPath()}/active`, { cache: 'no-store' });
  if (response.status === 204 || response.status === 404) return undefined;
  if (!response.ok) throw new Error('מסך המועדון אינו זמין כרגע.');
  const result = await response.json();
  return result.program as GroupWorkoutProgram | undefined;
};

export const syncClubDisplaySchedule = async (programs: GroupWorkoutProgram[]) => {
  if (!isPagesDemoMode()) return;
  const base = apiBase();
  if (!base) return;
  const scheduledPrograms = programs.filter(program => program.status === 'PUBLISHED' && program.sessionDate && program.sessionTime);
  const response = await fetch(`${base}${apiPath()}/schedule`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ programs: scheduledPrograms })
  });
  if (!response.ok) throw new Error('לא ניתן לסנכרן את לוח האימונים למסך המועדון.');
};
