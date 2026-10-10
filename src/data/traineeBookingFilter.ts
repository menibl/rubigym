import { MembershipType, User } from '../types';
import { hasIncludedOpenGymAccess } from '../../shared/open-gym-access.js';

export type BookingCategory = 'GROUP' | 'PERSONAL' | 'OPEN_GYM';
export type BookingFilter = BookingCategory | 'PRIMARY' | 'ALL';
const groupTypes: MembershipType[] = [MembershipType.CORE_GROUPS, MembershipType.GROUP_MONTHLY,
  MembershipType.GROUP_ANNUAL, MembershipType.FAMILY_MEMBERSHIP, MembershipType.YOUTH_ONCE_WEEKLY,
  MembershipType.YOUTH_TWICE_WEEKLY, MembershipType.DEDICATED_GROUP_HALF_YEAR,
  MembershipType.WEIGHT_LOSS_HALF_YEAR, MembershipType.POSTPARTUM_HALF_YEAR];
const openTypes: MembershipType[] = [MembershipType.OPEN_GYM, MembershipType.OPEN_GYM_WITH_PLAN,
  MembershipType.OPEN_MONTHLY, MembershipType.OPEN_ANNUAL, MembershipType.OPEN_PUNCH_CARD];

export function membershipBookingCategory(type?: MembershipType): BookingCategory | undefined {
  if (groupTypes.includes(type)) return 'GROUP';
  if ([MembershipType.PERSONAL_TRAINING, MembershipType.DUO_TRAINING].includes(type)) return 'PERSONAL';
  if (openTypes.includes(type)) return 'OPEN_GYM';
}

export function traineeBookingCategories(user: User) {
  const types = [user.membershipType, ...(user.secondaryMemberships || [])];
  const categories = new Set<BookingCategory>(types.map(membershipBookingCategory).filter(Boolean) as BookingCategory[]);
  if (hasIncludedOpenGymAccess(types)) categories.add('OPEN_GYM');
  const primary = membershipBookingCategory(user.membershipType) || [...categories][0];
  return { primary, additional: [...categories].filter(category => category !== primary) };
}

export const matchesBookingCategory = (filter: BookingFilter, primary: BookingCategory | undefined, category: BookingCategory) =>
  filter === 'ALL' || (filter === 'PRIMARY' ? !primary || primary === category : filter === category);
