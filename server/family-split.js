import { recurringPlan } from '../shared/recurring-billing.js';
import { familySelectedPlans } from '../shared/family-multiple-plans.js';

const cents = value => Math.round(Number(value) * 100);
const currentMonth = value => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit' }).format(new Date(value));

// Immutable prices come only from the active server catalog. A fixed discount
// is allocated once across the payable lines, not multiplied per family member.
export function familySplitLines(members, catalog, payments, discount, production, now = new Date()) {
  const cancelled = new Set(payments.filter(p => p.recurringCancelledAt).map(p => p.providerRecurringSaleId));
  const lines = members.filter(member => member.participation === 'INCLUDED').flatMap(member =>
    familySelectedPlans(member).map((selected, index) => {
      const config = catalog.find(plan => plan.id === selected.membershipType && plan.active !== false);
      if (!config) throw new Error('INVALID_MEMBERSHIP');
      const period = config.billingPeriod || (config.priceUnit === 'MONTH' ? 'MONTHLY' : 'ONE_TIME');
      const baseAmount = Number(config.price) * (selected.trainingSessionsCount || 1);
      const receipts = payments.filter(p => p.status === 'PAID' && !p.refundedAt && Boolean(p.isMock) !== production
        && ((p.traineeId === member.memberId && p.membershipTypePurchased === selected.membershipType)
          || (p.membershipTypePurchased === 'FAMILY_MEMBERSHIP' && (p.familyMemberPlans || []).some(item => item.memberId === member.memberId
            && (!item.participation || item.participation === 'INCLUDED') && familySelectedPlans(item).some(plan => plan.membershipType === selected.membershipType)))));
      const active = receipts.some(p => p.providerRecurringSaleId && !cancelled.has(p.providerRecurringSaleId)
        && Date.parse(p.timestamp || p.date) > now.getTime() - 366 * 86400000);
      const monthly = ['MONTHLY', 'MONTHLY_ANNUAL_COMMITMENT'].includes(period);
      const paid = monthly && receipts.some(p => Number.isFinite(Date.parse(p.timestamp || p.date)) && currentMonth(p.timestamp || p.date) === currentMonth(now));
      return { id: `${member.memberId}:${selected.membershipType}`, memberId: member.memberId, memberName: member.memberName,
        membershipType: selected.membershipType, label: config.label, baseAmount, amount: baseAmount,
        recurring: recurringPlan(config), billingPeriod: period,
        mode: index === 0 ? 'PRIMARY' : 'ADDON', includedSessions: selected.trainingSessionsCount,
        status: active ? 'EXISTING_RECURRING' : paid ? 'ALREADY_PAID' : 'READY' };
    }));
  const payable = lines.filter(line => line.status === 'READY');
  const total = payable.reduce((sum, line) => sum + cents(line.baseAmount), 0);
  const deduction = discount ? discount.discountPercent > 0
    ? Math.round(total * discount.discountPercent / 100) : Math.min(total, cents(discount.discountAmount)) : 0;
  let remaining = deduction;
  payable.forEach((line, index) => {
    const share = index === payable.length - 1 ? remaining : Math.floor(deduction * cents(line.baseAmount) / total);
    remaining -= share;
    line.amount = (cents(line.baseAmount) - share) / 100;
    line.discountAmount = share / 100;
    if (!(line.amount > 0)) throw new Error('SPLIT_ZERO_AMOUNT');
    if (line.recurring && !['MONTHLY', 'MONTHLY_ANNUAL_COMMITMENT'].includes(line.billingPeriod)) throw new Error('INVALID_RECURRING_PERIOD');
  });
  return lines;
}

export const publicFamilySplit = batch => ({ split: true, batchId: batch.id, items: batch.items.map(({ checkout, ...line }) => line),
  completed: Boolean(batch.cancelled) || batch.items.every(line => ['PAID', 'SETUP', 'EXISTING_RECURRING', 'ALREADY_PAID'].includes(line.status)),
  message: 'כל מסלול מאושר בנפרד. הוראת קבע מחויבת מדי חודש במשך 12 חיובים במחיר לאחר ההנחה; מסלול חד־פעמי מחויב פעם אחת בלבד. יצירת הוראה אינה אישור שהחיוב הראשון שולם.' });

export async function changeFamilySplit(store, clubId, payerId, mutate) {
  for (let i = 0; i < 5; i++) {
    const record = await store.getFamilySplitCheckout(clubId, payerId);
    const next = mutate(record.payload);
    if (!next) return record.payload;
    if (await store.putFamilySplitCheckout(clubId, payerId, next, record.revision)) return next;
  }
  throw new Error('FAMILY_SPLIT_CONFLICT');
}
