// The family discount applies to group subscriptions only, not Open Gym,
// personal training cards, nutrition, or other services.
export function familyPlanAmount(membershipType, amount) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value < 0) throw new Error('INVALID_FAMILY_PRICE');
  return Math.round(value * (['GROUP_MONTHLY', 'GROUP_ANNUAL'].includes(membershipType) ? 90 : 100)) / 100;
}
