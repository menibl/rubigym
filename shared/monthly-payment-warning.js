import { clubDate, nextMonthStart, isCalendarMembership } from './membership-calendar.js';

const groups = new Set(['CORE_GROUPS', 'GROUP_MONTHLY', 'GROUP_ANNUAL', 'YOUTH_ONCE_WEEKLY', 'YOUTH_TWICE_WEEKLY', 'DEDICATED_GROUP_HALF_YEAR', 'WEIGHT_LOSS_HALF_YEAR', 'POSTPARTUM_HALF_YEAR']);
const open = new Set(['OPEN_GYM', 'OPEN_MONTHLY', 'OPEN_ANNUAL', 'OPEN_GYM_WITH_PLAN']);
const category = type => groups.has(type) ? 'GROUP' : open.has(type) ? 'OPEN_GYM' : null;
export const monthlyMembershipCategory = category;
export const hasIncludedGroupAccess = user => [user?.membershipType, ...(user?.secondaryMemberships || [])].some(type => groups.has(type));
const selections = (payment, fallbackId) => payment.membershipTypePurchased === 'FAMILY_MEMBERSHIP' || payment.membershipType === 'FAMILY_MEMBERSHIP'
  ? (payment.familyMemberPlans || []).filter(p => !p.participation || p.participation === 'INCLUDED').map(p => ({ id: p.memberId, type: p.membershipType }))
  : [{ id: payment.traineeId || fallbackId, type: payment.membershipTypePurchased || payment.membershipType }];

// Receipt evidence only: an active user flag or an unpaid checkout is not a payment.
export function repeatedMonthlyPayments(payload, request, purchase = {}, now = new Date()) {
  const today = clubDate(now), month = today.slice(0, 7);
  const requested = selections({ ...request, familyMemberPlans: purchase.familyMemberPlans || request.familyMemberPlans }, request.userId).filter(p => p.id && category(p.type));
  const matches = new Map();
  for (const payment of payload?.payments || []) {
    if (payment.status !== 'PAID' || payment.refundedAt || payment.id === purchase.sourcePaymentId || payment.isMock) continue;
    const stamp = new Date(payment.timestamp || '');
    const date = Number.isFinite(stamp.getTime()) ? clubDate(stamp) : String(payment.date || '');
    if (date > today) continue;
    for (const paid of selections(payment)) {
      const match = requested.find(p => p.id === paid.id && (category(p.type) === category(paid.type)
        || (category(p.type) === 'OPEN_GYM' && groups.has(paid.type))));
      const user = payload.users?.find(u => u.id === match?.id);
      const currentExpiry = user?.membershipExpiry;
      const active = user?.membershipStatus === 'ACTIVE' && /^\d{4}-\d{2}-\d{2}$/.test(currentExpiry || '') && currentExpiry > today;
      if (date.slice(0, 7) !== month && !active) continue;
      if (match) {
        const boundary = active && !user.membershipExpiryExclusive
          ? new Date(Date.parse(`${currentExpiry}T00:00:00Z`) + 86400000).toISOString().slice(0, 10) : currentExpiry;
        matches.set(`${match.id}:${category(match.type)}`, { userId: match.id, type: match.type,
          name: user?.name || 'המתאמן', category: category(match.type),
          ...(active && isCalendarMembership(match.type) && !purchase.recurring ? { currentExpiry, newExpiry: nextMonthStart(boundary) } : {}) });
      }
    }
  }
  return [...matches.values()];
}
export function repeatedPaymentMessage(matches) {
  if (matches.some(match => match.newExpiry)) return `${matches.map(match => match.newExpiry
    ? `${match.name}: המנוי שלך בתוקף עד ${match.currentExpiry}. תשלום נוסף יאריך את התוקף עד ${match.newExpiry}.`
    : `${match.name}: כבר שולם עבור המסלול החודש.`).join('\n')}\nהאם תרצה לשלם שוב? לא יתבצע חיוב ללא אישורך.`;
  return `כבר שילמת החודש עבור ${matches.map(m => `${m.category === 'GROUP' ? 'אימונים קבוצתיים' : 'Open Gym'} — ${m.name}`).join(', ')}. האם ברצונך לשלם שוב? אישור יאפשר תשלום נוסף.`;
}
