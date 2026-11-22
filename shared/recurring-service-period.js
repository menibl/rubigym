const monthIndex = value => {
  const match = /^(20\d{2})-(0[1-9]|1[0-2])$/.exec(String(value || ''));
  return match ? Number(match[1]) * 12 + Number(match[2]) - 1 : null;
};
const monthAt = index => `${Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, '0')}`;

export function recurringServicePeriod(policy, charge) {
  const anchor = monthIndex(policy?.serviceMonth);
  if (policy?.version !== 1 || anchor === null || !Number.isInteger(policy.anchorCharge) || policy.anchorCharge < 1 || policy.anchorCharge > 12
    || !Number.isInteger(charge) || charge < 1 || charge > 12) return null;
  const first = anchor - policy.anchorCharge + 1;
  return { month: monthAt(first + charge - 1), expiresAt: `${monthAt(first + charge)}-01`, endsAt: `${monthAt(first + 12)}-01` };
}

export function approvedRecurringSchedule(payload, orderId, seriesId) {
  const checkout = payload.recurringCheckouts?.find(item => item.orderId === orderId && !item.cancelledAt && item.recurringSaleId === seriesId);
  const policy = checkout?.scheduleApproval;
  return policy?.id && policy.orderId === orderId && policy.seriesId === seriesId && policy.approvedBy && policy.approvedAt
    && recurringServicePeriod(policy, 1)?.endsAt === policy.coverageEndsAt ? policy : null;
}

export function recurringCheckoutEnd(checkout) {
  const policy = approvedRecurringSchedule({ recurringCheckouts: [checkout] }, checkout.orderId, checkout.recurringSaleId);
  return policy?.coverageEndsAt || checkout.endsAt;
}
