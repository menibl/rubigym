import { hasActiveWorkoutGymMembership } from './workout-gym-access.js';

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const decimal = (value, max, label, integer = false) => {
  if (typeof value !== 'string' || value.length > 12) fail(`${label} אינו תקין.`);
  const clean = value.trim();
  if (!clean) return '';
  if (!/^\d+(?:\.\d{1,2})?$/.test(clean) || Number(clean) > max || (integer && !Number.isInteger(Number(clean)))) fail(`${label} אינו בטווח המותר.`);
  return String(Number(clean));
};

export function updateExerciseWorkingValues(payload, actorId, input) {
  const actor = (payload.users || []).find(user => user.id === actorId);
  const staff = ['MANAGER', 'COACH'].includes(actor?.role);
  if (!staff && actor?.role !== 'TRAINEE') fail('אין הרשאה לעריכת התרגיל.', 403);
  const plan = (payload.workoutPlans || []).find(item => item.id === input?.planId);
  if (!plan || plan.libraryEntry || plan.sessionId || (!staff && plan.traineeId !== actorId)) fail('התוכנית אינה זמינה לעריכה.', 403);
  if (!staff && !hasActiveWorkoutGymMembership(actor)) fail('נדרש מנוי כניסה בתוקף לצפייה ועריכת התוכנית.', 403);
  const exercise = (plan.exercises || []).find(item => item.id === input.exerciseId);
  if (!exercise) fail('התרגיל השתנה. יש לרענן את התוכנית.', 409);
  const revision = exercise.workingValues?.revision || 0;
  if (input.expectedRevision !== revision) fail('המאמן או המתאמן עדכנו את הערכים. יש לרענן ולנסות שוב.', 409);
  const workingValues = {
    weightKg: decimal(input.weightKg, 1500, 'משקל העבודה'),
    restSeconds: decimal(input.restSeconds, 3600, 'זמן המנוחה', true),
    revision: revision + 1
  };
  return { ...payload, workoutPlans: payload.workoutPlans.map(item => item.id === plan.id
    ? { ...item, exercises: item.exercises.map(ex => ex.id === exercise.id ? { ...ex, workingValues } : ex) } : item) };
}

// Dedicated endpoint owns these values. Generic/stale coach saves must not erase
// trainee edits or copy another trainee's values into a new template/assignment.
export function preserveExerciseWorkingValues(current, incoming) {
  const existing = new Map((current.workoutPlans || []).map(plan => [plan.id, new Map((plan.exercises || []).map(ex => [ex.id, ex.workingValues]))]));
  return { ...incoming, workoutPlans: (incoming.workoutPlans || []).map(plan => !Array.isArray(plan.exercises) ? plan : ({ ...plan,
    exercises: (plan.exercises || []).map(ex => {
      const { workingValues: _ignored, ...rest } = ex;
      const saved = existing.get(plan.id)?.get(ex.id);
      return saved ? { ...rest, workingValues: saved } : rest;
    })
  })) };
}
