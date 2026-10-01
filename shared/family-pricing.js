export function familyPlanAmount(type, amount) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value < 0) throw new Error('INVALID_FAMILY_PRICE');
  return Math.round(value * (['GROUP_MONTHLY', 'GROUP_ANNUAL'].includes(type) ? 90 : 100)) / 100;
}
