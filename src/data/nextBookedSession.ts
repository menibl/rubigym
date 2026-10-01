import type { OpenGymSession, TrainingSession } from '../types';

export function nextBookedSession(userId: string, sessions: TrainingSession[], openGymSessions: OpenGymSession[], now = new Date()) {
  const candidates = [
    ...sessions.map(session => ({
      ...session, kind: 'SESSION' as const, startTime: session.time,
    })),
    ...openGymSessions.map(session => ({
      ...session, kind: 'OPEN_GYM' as const, title: 'Open Gym · אימון חופשי',
      time: session.timeSlot, startTime: session.timeSlot.split('-')[0].trim(), coachName: '',
    })),
  ].filter(session => session.registeredUsers.includes(userId))
    .map(session => ({ ...session, startsAt: new Date(`${session.date}T${session.startTime.trim()}`).getTime() }))
    .filter(session => Number.isFinite(session.startsAt) && session.startsAt >= now.getTime())
    .sort((a, b) => a.startsAt - b.startsAt || a.id.localeCompare(b.id));
  return candidates[0];
}
