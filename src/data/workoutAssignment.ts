import { GroupWorkoutProgram, TrainingSession, User, WorkoutPlan } from '../types';

export const copyPersonalPlanToSessions = (
  source: WorkoutPlan,
  sessions: TrainingSession[],
  traineeId: string | undefined,
  activeUser: User
): WorkoutPlan[] => sessions.map((session, sessionIndex) => {
  const stamp = `${Date.now()}-${sessionIndex}`;
  return {
    ...source,
    id: `session-plan-${stamp}`,
    traineeId: traineeId || `demo-session-${session.id}`,
    sessionId: session.id,
    sourcePlanId: source.id,
    libraryEntry: false,
    coachId: activeUser.id,
    coachName: activeUser.name,
    lastUpdated: new Date().toISOString().split('T')[0],
    exercises: source.exercises.map((exercise, exerciseIndex) => ({
      ...exercise,
      id: `session-exercise-${stamp}-${exerciseIndex}`
    }))
  };
});

const parseDisplaySeconds = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return /min|דק/i.test(value || '') ? parsed * 60 : parsed;
};

export const personalPlanToDisplayProgram = (
  plan: WorkoutPlan,
  displayName = 'אימון אישי',
  session?: Pick<TrainingSession, 'id' | 'date' | 'time'>
): GroupWorkoutProgram => ({
  id: `personal-display-${plan.id}`,
  sessionId: session?.id,
  sessionDate: session?.date,
  sessionTime: session?.time,
  groupName: displayName,
  title: plan.title || 'תוכנית אימון אישית',
  description: `תוכנית אישית בהנחיית ${plan.coachName}`,
  coachId: plan.coachId,
  coachName: plan.coachName,
  exercises: plan.exercises.map(exercise => ({
    ...exercise,
    workSeconds: plan.effortMetric === 'REPS' ? 0 : parseDisplaySeconds(exercise.workDuration, plan.defaultWorkSeconds ?? 45),
    restSeconds: plan.effortMetric === 'REPS' ? 0 : parseDisplaySeconds(exercise.restDuration, plan.defaultRestSeconds ?? 60),
    rounds: Math.max(1, exercise.sets)
  })),
  defaultWorkSeconds: plan.effortMetric === 'REPS' ? 0 : plan.defaultWorkSeconds ?? 45,
  defaultRestSeconds: plan.effortMetric === 'REPS' ? 0 : plan.defaultRestSeconds ?? 60,
  effortMetric: plan.effortMetric || 'TIME',
  defaultRepetitions: plan.defaultRepetitions,
  preparationSeconds: 10,
  status: 'PUBLISHED',
  createdAt: plan.lastUpdated,
  updatedAt: new Date().toISOString(),
  publishedAt: plan.lastUpdated
});

export const copyGroupProgramToSessions = (
  source: GroupWorkoutProgram,
  sessions: TrainingSession[],
  activeUser: User,
  users: User[]
): GroupWorkoutProgram[] => sessions.map((session, sessionIndex) => {
  const stamp = `${Date.now()}-${sessionIndex}`;
  const stationCount = Math.max(1, (source.stations || []).length);
  const participants = session.registeredUsers.map((userId, index) => ({
    id: userId,
    name: users.find(user => user.id === userId)?.name || `מתאמן ${index + 1}`,
    groupIndex: index % stationCount
  }));
  const now = new Date().toISOString();
  return {
    ...source,
    id: `group-program-${stamp}`,
    sourceProgramId: source.id,
    libraryEntry: false,
    sessionId: session.id,
    sessionDate: session.date,
    sessionTime: session.time,
    groupName: session.title,
    coachId: activeUser.id,
    coachName: activeUser.name,
    exercises: source.exercises.map((exercise, exerciseIndex) => ({
      ...exercise,
      id: `group-exercise-${stamp}-${exerciseIndex}`
    })),
    stations: (source.stations || []).map((station, stationIndex) => ({
      ...station,
      id: `group-station-${stamp}-${stationIndex}`,
      exercises: station.exercises.map((exercise, exerciseIndex) => ({
        ...exercise,
        id: `group-station-exercise-${stamp}-${stationIndex}-${exerciseIndex}`
      }))
    })),
    participants,
    participantCount: participants.length,
    createdAt: now,
    updatedAt: now,
    publishedAt: source.status === 'PUBLISHED' ? now : undefined
  };
});
