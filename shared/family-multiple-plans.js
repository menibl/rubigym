export const familySelectedPlans = plan => [
  { membershipType: plan.membershipType, trainingSessionsCount: plan.trainingSessionsCount },
  ...(plan.additionalPlans || [])
];

// Use the same entitlement rules on the verified server receipt and Pages demo.
export function familyPurchaseBenefits(user, plan) {
  if (plan.participation && plan.participation !== 'INCLUDED') return {};
  const selected = familySelectedPlans(plan);
  const types = selected.map(item => item.membershipType);
  const result = {
    secondaryMemberships: [...new Set([...(user.secondaryMemberships || []),
      ...(plan.additionalPlans || []).map(item => item.membershipType)])].filter(type => type !== plan.membershipType),
    nutritionPlanPaid: Boolean(user.nutritionPlanPaid || types.some(type => ['NUTRITION_COACHING', 'NUTRITION_PLAN'].includes(type))),
    requestedWorkoutPlan: Boolean(user.requestedWorkoutPlan || types.some(type => ['WORKOUT_COACHING', 'WORKOUT_PLAN', 'OPEN_GYM_WITH_PLAN'].includes(type)))
  };
  for (const [type, balance] of [['PERSONAL_TRAINING', 'personalTrainingRemaining'], ['DUO_TRAINING', 'duoTrainingRemaining']]) {
    const item = selected.find(item => item.membershipType === type);
    if (item) result[balance] = (plan.membershipType === type ? 0 : Number(user[balance]) || 0)
      + Math.max(1, Math.min(50, Math.round(Number(item.trainingSessionsCount) || 1)));
  }
  return result;
}
