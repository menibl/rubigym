import { GroupWorkoutProgram, TrainingSession, User, WorkoutPlan } from '../types';

export const copyPersonalPlanToSessions = (
  source: WorkoutPlan,
  sessions: TrainingSession[],
  traineeId: string,
  activeUser: User
): WorkoutPlan[] => sessions.map((session, sessionIndex) => {
  const stamp = `${Date.now()}-${sessionIndex}`;
  return {
    ...source,
    id: `session-plan-${stamp}`,
    traineeId,
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
