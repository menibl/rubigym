import { clubDate } from './membership-calendar.js';
import { validReminderDate } from './payment-reminder-policy.js';
import { isTestPayment } from './admin-trainees.js';
import { uniquePayments } from './payment-ledger.js';

export function financePaymentSource(payment) {
  if (payment.provider === 'MANUAL') return 'manual';
  if (payment.provider === 'RIVHIT') return 'rivhit';
  if (payment.provider) return 'unclassified';
  if (/^manual-payment-/.test(String(payment.id)) || /מזומן|העברה|תועד ידנית|\bcash\b/i.test(String(payment.paymentMethod || ''))) return 'manual';
  if (/^payment-rivhit-/.test(String(payment.id)) || /rivhit|icredit|רווחית|ריווחית/i.test(String(payment.paymentMethod || ''))) return 'rivhit';
  return 'unclassified';
}

export function financePaymentDate(payment) {
  const timestamp = new Date(payment.timestamp || '');
  const date = Number.isFinite(timestamp.getTime()) ? clubDate(timestamp) : payment.date;
  return validReminderDate(date) ? date : undefined;
}

function summarize(payments) {
  const result = { transactionCount: payments.length, totalAmount: 0, paidCount: 0, pendingCount: 0, rivhitPendingCount: 0, otherPendingCount: 0, refundedCount: 0, invalidAmountCount: 0,
    rivhit: { amount: 0, count: 0 }, manual: { amount: 0, count: 0 }, unclassified: { amount: 0, count: 0 } };
  for (const payment of payments) {
    if (payment.status === 'PENDING') {
      result.pendingCount++;
      if (financePaymentSource(payment) === 'rivhit') result.rivhitPendingCount++;
      else result.otherPendingCount++;
      continue;
    }
    if (payment.status === 'REFUNDED') { result.refundedCount++; continue; }
    if (payment.status !== 'PAID') continue;
    if (typeof payment.amount !== 'number' || !Number.isFinite(payment.amount) || payment.amount < 0) { result.invalidAmountCount++; continue; }
    const cents = Math.round(payment.amount * 100);
    const source = result[financePaymentSource(payment)];
    source.amount += cents; source.count++;
    result.totalAmount += cents; result.paidCount++;
  }
  for (const key of ['rivhit', 'manual', 'unclassified']) result[key].amount /= 100;
  result.totalAmount /= 100;
  return result;
}

export function financeSummary(payments = [], users = [], now = new Date()) {
  const today = clubDate(now), month = today.slice(0, 7);
  const real = uniquePayments(payments.filter(payment => !isTestPayment(payment)));
  const monthly = real.filter(payment => {
    const date = financePaymentDate(payment);
    return date?.startsWith(`${month}-`) && date <= today;
  });
  const pendingSeries = new Set(), failedSeries = new Set();
  for (const user of users) for (const [type, contract] of Object.entries(user.recurringMemberships || {})) {
    if (contract.cancelledAt || contract.isMock || !validReminderDate(contract.endsAt) || contract.endsAt <= today) continue;
    const key = contract.seriesId ? `series:${String(contract.seriesId).toLowerCase()}` : contract.orderId ? `order:${contract.orderId}` : `member:${user.id}:${type}`;
    if (contract.status === 'PAYMENT_FAILED') failedSeries.add(key);
    else if (contract.status === 'PENDING_FIRST_CHARGE' || (contract.status === 'ACTIVE' && (!validReminderDate(contract.paidUntil) || contract.paidUntil <= today))) pendingSeries.add(key);
  }
  // A shared family instruction is one instruction, never one per beneficiary.
  for (const key of failedSeries) pendingSeries.delete(key);
  return { month, today, monthly: summarize(monthly), lifetime: summarize(real),
    pendingRecurringCount: pendingSeries.size, failedRecurringCount: failedSeries.size,
    excludedTestCount: payments.filter(isTestPayment).length,
    unassignedDateCount: real.filter(payment => !financePaymentDate(payment)).length };
}
