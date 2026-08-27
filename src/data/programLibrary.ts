import { GroupWorkoutProgram, NutritionPlan, User, WorkoutPlan } from '../types';

const localDate = (value = new Date()) => value.toLocaleDateString('he-IL', {
  day: '2-digit', month: '2-digit', year: 'numeric'
});

const localTime = (value = new Date()) => value.toLocaleTimeString('he-IL', {
  hour: '2-digit', minute: '2-digit'
});

const cloneId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export const personalLibraryTitle = (traineeName: string, createdAt = new Date()) =>
  `תוכנית אישית · ${traineeName} · ${localDate(createdAt)}`;

export const nutritionLibraryTitle = (traineeName: string, createdAt = new Date()) =>
  `תוכנית תזונה · ${traineeName} · ${localDate(createdAt)}`;

export const groupLibraryTitle = (program: GroupWorkoutProgram, createdAt = new Date()) => {
  const customTitle = program.title?.trim() || program.groupName?.trim() || 'אימון קבוצתי';
  const scheduled = program.sessionDate
    ? `${program.groupName || 'קבוצה'} · ${program.sessionDate}${program.sessionTime ? ` ${program.sessionTime}` : ''}`
    : `${localDate(createdAt)} ${localTime(createdAt)}`;
  return `${customTitle} · ${scheduled}`;
};

export const createPersonalLibraryEntry = (
  plan: WorkoutPlan,
  trainee: Pick<User, 'name'>,
  sourcePlanId?: string,
  createdAt = new Date()
): WorkoutPlan => ({
  ...plan,
  id: cloneId('personal-library'),
  sessionId: undefined,
  sourcePlanId: sourcePlanId || plan.sourcePlanId || plan.id,
  title: plan.title?.trim() || personalLibraryTitle(trainee.name, createdAt),
  libraryEntry: true,
  libraryCreatedAt: createdAt.toISOString(),
  lastUpdated: createdAt.toISOString().split('T')[0],
  exercises: plan.exercises.map((exercise, index) => ({
    ...exercise,
    id: `${cloneId('personal-library-exercise')}-${index}`
  }))
});

export const createNutritionLibraryEntry = (
  plan: NutritionPlan,
  trainee: Pick<User, 'name'>,
  sourcePlanId?: string,
  createdAt = new Date()
): NutritionPlan => ({
  ...plan,
  id: cloneId('nutrition-library'),
  sourcePlanId: sourcePlanId || plan.sourcePlanId || plan.id,
  title: plan.title?.trim() || nutritionLibraryTitle(trainee.name, createdAt),
  libraryEntry: true,
  libraryCreatedAt: createdAt.toISOString(),
  lastUpdated: createdAt.toISOString().split('T')[0],
  active: false,
  categories: (plan.categories || []).map((meal, index) => ({
    ...meal,
    id: `${cloneId('nutrition-library-meal')}-${index}`
  }))
});

export const createGroupLibraryEntry = (
  program: GroupWorkoutProgram,
  createdAt = new Date()
): GroupWorkoutProgram => ({
  ...program,
  id: cloneId('group-library'),
  sourceProgramId: program.sourceProgramId || program.id,
  sessionId: undefined,
  sessionDate: undefined,
  sessionTime: undefined,
  participants: [],
  participantCount: program.participantCount,
  title: groupLibraryTitle(program, createdAt),
  libraryEntry: true,
  exercises: program.exercises.map((exercise, index) => ({
    ...exercise,
    id: `${cloneId('group-library-exercise')}-${index}`
  })),
  stations: (program.stations || []).map((station, stationIndex) => ({
    ...station,
    id: `${cloneId('group-library-station')}-${stationIndex}`,
    exercises: station.exercises.map((exercise, exerciseIndex) => ({
      ...exercise,
      id: `${cloneId('group-library-station-exercise')}-${stationIndex}-${exerciseIndex}`
    }))
  })),
  createdAt: createdAt.toISOString(),
  updatedAt: createdAt.toISOString(),
  publishedAt: createdAt.toISOString(),
  status: 'PUBLISHED'
});

export const isPersonalLibraryEntry = (plan: WorkoutPlan) => plan.libraryEntry === true;
export const isActivePersonalPlan = (plan: WorkoutPlan) => !plan.sessionId && plan.libraryEntry !== true;
export const isNutritionLibraryEntry = (plan: NutritionPlan) => plan.libraryEntry === true;
export const isActiveNutritionPlan = (plan: NutritionPlan) => plan.libraryEntry !== true && plan.active !== false;
