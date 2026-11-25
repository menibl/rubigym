import type { OpenGymSession, TrainingSession } from '../types';

export type CalendarSelection = {
  type: 'SESSION' | 'OPEN_GYM';
  session?: TrainingSession;
  openGym?: OpenGymSession;
};

// Selection identifies an occurrence, not a frozen copy of its registrations.
// Call with the current day's expanded items to support virtual recurring slots.
export function resolveCalendarSelection(
  selected: CalendarSelection | null,
  items: { sessions: TrainingSession[]; openGym: OpenGymSession[] }
): CalendarSelection | null {
  if (!selected) return null;
  if (selected.type === 'SESSION' && selected.session) {
    const session = items.sessions.find(item => item.id === selected.session!.id && item.date === selected.session!.date);
    return session ? { type: 'SESSION', session } : null;
  }
  if (selected.type === 'OPEN_GYM' && selected.openGym) {
    const openGym = items.openGym.find(item => item.id === selected.openGym!.id && item.date === selected.openGym!.date);
    return openGym ? { type: 'OPEN_GYM', openGym } : null;
  }
  return null;
}
