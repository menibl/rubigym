import { membershipAge } from './youth-plan.js';

export function matchesAnnouncement(user, announcement, now = new Date()) {
  if (user?.role !== 'TRAINEE' || user.registrationIncomplete) return false;
  if (announcement.targetGender && announcement.targetGender !== 'ALL' && user.gender !== announcement.targetGender) return false;
  const age = membershipAge(user, now);
  if (Number.isFinite(announcement.targetAgeMin) && (age === null || age < announcement.targetAgeMin)) return false;
  if (Number.isFinite(announcement.targetAgeMax) && (age === null || age > announcement.targetAgeMax)) return false;
  const types = [user.membershipType, ...(user.secondaryMemberships || [])];
  return !announcement.targetMembershipTypes?.length || announcement.targetMembershipTypes.some(type => types.includes(type));
}
