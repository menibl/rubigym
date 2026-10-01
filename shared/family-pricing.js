export function familyPlanAmount(type, amount) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value < 0) throw new Error('INVALID_FAMILY_PRICE');
  return Math.round(value * 100) / 100;
}
