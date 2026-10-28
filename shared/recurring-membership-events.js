import { clubDate, nextMonthStart } from './membership-calendar.js';
import { validReminderDate } from './payment-reminder-policy.js';
import { membershipTypesForAccess } from './recurring-access.js';

export function rivhitChargeDate(sale) {
  const value = String(sale?.TransactionDateTime || sale?.SaleTime || '');
  const match = value.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:\s|$)/);
  const date = match ? `${match[3]}-${match[2]}-${match[1]}` : '';
  return validReminderDate(date) ? date : undefined;
}

// Call only with an authenticated provider result and a verified signed order.
// Never infer a paid receipt from an approved recurring contract.
export function applyRecurringMembershipEvent(payload, order, payment, now = new Date()) {
  const userId = order.bu || order.u;
  const user = payload.users?.find(member => member.id === userId);
  if (!user || order.rc !== 1 || !payment.recurringSaleId || !validReminderDate(order.re)) throw new Error('INVALID_RECURRING_MEMBERSHIP_EVENT');
  const type = order.m, old = user.recurringMemberships?.[type];
  const charge = Number(payment.recurringChargeNumber);
  const kind = payment.recurringFailed ? 'FAILED' : payment.recurringPending ? 'SETUP' : 'PAID';
  if (kind === 'SETUP' && order.re <= clubDate(now)) return payload;
  const eventKey = `${kind}:${payment.saleId}:${charge}`;
  const sameSeries = old?.seriesId === payment.recurringSaleId;
  if (old && !sameSeries && ['PENDING_FIRST_CHARGE', 'ACTIVE'].includes(old.status) && old.endsAt > clubDate(now)) throw new Error('RECURRING_CONTRACT_CONFLICT');
  const previous = sameSeries ? old : undefined;
  if (previous?.cancelledAt) return payload;
  const historicalPaid = (payload.payments || []).filter(receipt => receipt.traineeId === userId && receipt.status === 'PAID'
    && receipt.providerRecurringSaleId === payment.recurringSaleId).map(receipt => Number(receipt.recurringChargeNumber) || 0);
  const paidCharge = Math.max(previous?.lastPaidCharge || 0, ...historicalPaid, 0);
  // The current paid receipt is appended before this projection. An equal paid
  // counter must still be applied once; failed/setup events cannot undo it.
  if (previous?.events?.includes(eventKey) || (kind === 'SETUP' && (paidCharge > 0 || previous?.status === 'PAYMENT_FAILED'))
    || (kind === 'FAILED' && paidCharge >= charge && paidCharge > 0)
    || (kind === 'PAID' && charge < Math.max(previous?.lastPaidCharge || 0, previous?.lastFailedCharge || 0))) return payload;
  if (!Number.isInteger(charge) || charge < 0 || charge > 12 || (kind === 'PAID' && charge < 1)) throw new Error('INVALID_RECURRING_MEMBERSHIP_EVENT');
  const started = new Date(Number(order.t));
  const [year, month] = clubDate(started).split('-').map(Number);
  const fallback = new Date(Date.UTC(year, month + charge - 1, 1)).toISOString().slice(0, 10);
  const paidUntil = kind === 'PAID' ? payment.providerChargeDate ? nextMonthStart(payment.providerChargeDate) : fallback : previous?.paidUntil;
  const contract = { ...previous, seriesId: payment.recurringSaleId, orderId: order.o,
    status: kind === 'FAILED' ? 'PAYMENT_FAILED' : kind === 'SETUP' ? 'PENDING_FIRST_CHARGE' : 'ACTIVE',
    endsAt: order.re, amount: Number(order.a), discountCode: order.c || null, paidUntil,
    approvedAt: previous?.approvedAt || (kind !== 'FAILED' ? now.toISOString() : undefined),
    lastPaidCharge: kind === 'PAID' ? Math.max(paidCharge, charge) : paidCharge,
    lastFailedCharge: kind === 'FAILED' ? charge : previous?.lastFailedCharge,
    lastFailureCode: kind === 'FAILED' ? String(payment.recurringFailureCode || '').slice(0, 16) : undefined,
    updatedAt: now.toISOString(), events: [...(previous?.events || []), eventKey].slice(-100) };
  let updated = { ...user, recurringMemberships: { ...user.recurringMemberships, [type]: contract } };
  if (kind !== 'FAILED') {
    const term = paidUntil || nextMonthStart(clubDate(now));
    const retainPrimary = user.membershipType && user.membershipType !== type && user.membershipStatus === 'ACTIVE';
    updated = { ...updated, membershipStatus: 'ACTIVE', registrationPaymentPending: false, familyPaymentPending: false,
      membershipType: retainPrimary ? user.membershipType : type,
      secondaryMemberships: retainPrimary ? [...new Set([...(user.secondaryMemberships || []), type])] : (user.secondaryMemberships || []).filter(item => item !== type),
      membershipPlanExpiries: { ...user.membershipPlanExpiries, [type]: term },
      ...(!retainPrimary ? { membershipExpiry: term, membershipExpiryExclusive: true, monthlyBillingDay: 1,
        membershipCommitmentEndsAt: order.re, recurringBillingMonths: 12 } : {}) };
  } else if (!membershipTypesForAccess(updated).length) updated.membershipStatus = 'DEBT';
  const staff = (payload.users || []).filter(member => ['MANAGER', 'COACH'].includes(member.role));
  const sender = staff.find(member => member.role === 'MANAGER') || staff[0];
  const recipients = [...new Set([userId, order.u, ...staff.map(member => member.id)].filter(Boolean))];
  const label = payload.settings?.membershipPlans?.find(plan => plan.id === type)?.label || type;
  const content = kind === 'FAILED'
    ? `חיוב הוראת הקבע עבור ${user.name}, מסלול ${label}, נכשל לפי אישור רווחית. המסלול הושהה עד להסדרת התשלום. מסלולים אחרים לא הושהו. יש לפנות למנהל; אין לבצע תשלום כפול.`
    : kind === 'SETUP' ? `הוראת הקבע עבור ${user.name}, מסלול ${label}, אושרה ברווחית. המנוי פעיל — ממתין לאישור החיוב הראשון. אין עדיין תשלום שהושלם. סכום כל חיוב: ₪${order.a}.`
      : `אושר חיוב ${charge} בהוראת הקבע עבור ${user.name}, מסלול ${label}: ₪${order.a}. תשלום מאומת עד ${paidUntil}.`;
  const messages = sender ? recipients.map(receiverId => ({ id: `recurring-${payment.recurringSaleId}-${eventKey}-${receiverId}`,
    senderId: staff.some(member => member.id === receiverId) ? user.id : sender.id,
    senderName: staff.some(member => member.id === receiverId) ? user.name : sender.name,
    senderRole: staff.some(member => member.id === receiverId) ? 'TRAINEE' : sender.role, receiverId, content: `עדכון תשלום אוטומטי\n${content}`,
    timestamp: now.toISOString(), read: false, systemGenerated: true,
    actionUrl: staff.some(member => member.id === receiverId) ? '?workspace=club_management' : '?workspace=my_membership',
    actionLabel: staff.some(member => member.id === receiverId) ? 'ניהול מתאמנים' : 'המנוי והתשלומים שלי' })).filter(message => !(payload.messages || []).some(existing => existing.id === message.id)) : [];
  return { ...payload, users: payload.users.map(member => member.id === userId ? updated : member), messages: [...(payload.messages || []), ...messages] };
}
