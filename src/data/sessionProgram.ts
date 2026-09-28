import type { TrainingSession, WorkoutPlan, GroupWorkoutProgram } from '../types';

// A calendar assignment is authoritative, including legacy assignments that only
// carry sessionId. Do not infer access from a trainee's unrelated personal plan.
export function resolveSessionProgram(session: TrainingSession, plans: WorkoutPlan[], programs: GroupWorkoutProgram[]) {
  const personal = plans.find(plan => plan.id === session.assignedWorkoutPlanId && plan.exercises.length > 0)
    || plans.find(plan => plan.sessionId === session.id && !plan.libraryEntry && plan.exercises.length > 0);
  const group = programs.find(program => program.id === session.assignedGroupWorkoutProgramId)
    || programs.find(program => program.sessionId === session.id && !program.libraryEntry);
  return { personal, group };
}
