import { clubDate } from './membership-calendar.js';

const groups = new Set(['CORE_GROUPS', 'GROUP_MONTHLY', 'GROUP_ANNUAL', 'YOUTH_ONCE_WEEKLY', 'YOUTH_TWICE_WEEKLY', 'DEDICATED_GROUP_HALF_YEAR', 'WEIGHT_LOSS_HALF_YEAR', 'POSTPARTUM_HALF_YEAR']);
const open = new Set(['OPEN_GYM', 'OPEN_MONTHLY', 'OPEN_ANNUAL', 'OPEN_GYM_WITH_PLAN']);
const category = type => groups.has(type) ? 'GROUP' : open.has(type) ? 'OPEN_GYM' : null;
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
    if (date.slice(0, 7) !== month || date > today) continue;
    for (const paid of selections(payment)) {
      const match = requested.find(p => p.id === paid.id && (category(p.type) === category(paid.type)
        || (category(p.type) === 'OPEN_GYM' && groups.has(paid.type))));
      if (match) matches.set(`${match.id}:${category(match.type)}`, { userId: match.id,
        name: payload.users?.find(u => u.id === match.id)?.name || 'המתאמן', category: category(match.type) });
    }
  }
  return [...matches.values()];
}
export function repeatedPaymentMessage(matches) {
  return `כבר שילמת החודש עבור ${matches.map(m => `${m.category === 'GROUP' ? 'אימונים קבוצתיים' : 'Open Gym'} — ${m.name}`).join(', ')}. האם ברצונך לשלם שוב? אישור יאפשר תשלום נוסף.`;
}
