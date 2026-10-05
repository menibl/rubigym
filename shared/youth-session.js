const youth = new Set(['YOUTH_ONCE_WEEKLY', 'YOUTH_TWICE_WEEKLY']);
export const isYouthSession = session => !session.isPersonalTraining && (
  /נוער/.test(String(session.title || '')) || (session.allowedMemberships?.length > 0 && session.allowedMemberships.every(type => youth.has(type)))
);
export const sessionAgeMax = session => isYouthSession(session) ? 18 : session.ageMax;
export const fitsSessionAge = (session, user) => {
  const max = sessionAgeMax(session), min = session.ageMin;
  if (!min && !max) return true;
  return Number.isFinite(user.age) && user.age > 0 && (!min || user.age >= min) && (!max || user.age <= max);
};
