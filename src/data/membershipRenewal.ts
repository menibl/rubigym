import { clubDate } from '../../shared/membership-calendar.js';
import { User, MembershipType, FamilyMemberPlanSelection } from '../types';
const date = (value?: string) => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T12:00:00Z`)));

export function activePlanExpiry(user: User, type = user.membershipType, today = clubDate()): string | null {
  if (!type || user.registrationIncomplete) return null;
  const contract = user.recurringMemberships?.[type];
  if (contract?.cancelledAt || contract?.status === 'PAYMENT_FAILED') return null;
  if (contract && ['ACTIVE', 'PENDING_FIRST_CHARGE'].includes(contract.status) && contract.endsAt > today) return contract.endsAt;
  const expiry = (type === user.membershipType ? user.membershipExpiry : undefined) || user.membershipPlanExpiries?.[type];
  if (!date(expiry) || (type === user.membershipType && user.membershipStatus !== 'ACTIVE' && !user.offlinePaymentApproved)) return null;
  const exclusive = type === user.membershipType ? user.membershipExpiryExclusive : true;
  return (exclusive ? expiry! > today : expiry! >= today) ? expiry! : null;
}

export function primaryMembershipExpired(user: User, today = clubDate()): boolean {
  if (!user.membershipType || user.registrationIncomplete || activePlanExpiry(user, user.membershipType, today)) return false;
  const expiry = user.membershipExpiry || user.membershipPlanExpiries?.[user.membershipType];
  return user.membershipStatus === 'EXPIRED' || Boolean(date(expiry) && (user.membershipExpiryExclusive ? expiry! <= today : expiry! < today));
}

// A fresh checkout draft never changes existing membership/payment records.
export const emptyFamilyPurchase = (members: Array<Pick<User, 'id' | 'name'>>): FamilyMemberPlanSelection[] => members.map(member => ({
  memberId: member.id, memberName: member.name, membershipType: '' as MembershipType, participation: 'NOT_STARTED', additionalPlans: []
}));
