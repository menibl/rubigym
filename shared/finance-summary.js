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
    rivhitPendingAmount: 0, otherPendingAmount: 0, invalidPendingAmountCount: 0,
    recurringPaid: { amount: 0, count: 0 }, oneTimePaid: { amount: 0, count: 0 },
    rivhit: { amount: 0, count: 0 }, manual: { amount: 0, count: 0 }, unclassified: { amount: 0, count: 0 } };
  for (const payment of payments) {
    if (payment.status === 'PENDING') {
      result.pendingCount++;
      if (financePaymentSource(payment) === 'rivhit') result.rivhitPendingCount++;
      else result.otherPendingCount++;
      if (validAmount(payment.amount)) result[financePaymentSource(payment) === 'rivhit' ? 'rivhitPendingAmount' : 'otherPendingAmount'] += Math.round(payment.amount * 100);
      else result.invalidPendingAmountCount++;
      continue;
    }
    if (payment.status === 'REFUNDED') { result.refundedCount++; continue; }
    if (payment.status !== 'PAID') continue;
    if (typeof payment.amount !== 'number' || !Number.isFinite(payment.amount) || payment.amount < 0) { result.invalidAmountCount++; continue; }
    const cents = Math.round(payment.amount * 100);
    const source = result[financePaymentSource(payment)];
    source.amount += cents; source.count++;
    if (financePaymentSource(payment) === 'rivhit') {
      const kind = payment.providerRecurringSaleId ? result.recurringPaid : result.oneTimePaid;
      kind.amount += cents; kind.count++;
    }
    result.totalAmount += cents; result.paidCount++;
  }
  for (const key of ['rivhit', 'manual', 'unclassified', 'recurringPaid', 'oneTimePaid']) result[key].amount /= 100;
  result.rivhitPendingAmount /= 100; result.otherPendingAmount /= 100;
  result.totalAmount /= 100;
  return result;
}

const validAmount = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;

// These are local outstanding instruction amounts, NOT proof of a provider debit.
// Never multiply by twelve or add them to paid money. Family groupAmount is the
// signed combined amount and must be counted once, even with incomplete members.
function pendingInstructions(groups, failed, payments, today) {
  const rows = [];
  for (const [key, entries] of groups) {
    if (failed.has(key)) continue;
    const contracts = entries.map(entry => entry.contract);
    const series = contracts[0].seriesId?.toLowerCase();
    if (series && payments.some(payment => payment.status === 'PAID'
      && payment.providerRecurringSaleId?.toLowerCase() === series
      && financePaymentDate(payment)?.slice(0, 7) === today.slice(0, 7))) continue;
    const grouped = contracts.some(contract => contract.groupAmount != null || contract.groupSize > 1);
    const amounts = contracts.map(contract => grouped ? contract.groupAmount : contract.amount);
    const known = amounts.every(validAmount) && new Set(amounts.map(amount => Math.round(amount * 100))).size === 1
      && (grouped || entries.length === 1);
    const dates = contracts.map(contract => contract.status === 'ACTIVE' ? contract.paidUntil
      : financePaymentDate({ timestamp: contract.approvedAt }));
    const date = dates.every(value => validReminderDate(value) && value <= today) && new Set(dates).size === 1 ? dates[0] : undefined;
    rows.push({ key, names: [...new Set(entries.map(entry => entry.name))], amount: known ? Math.round(amounts[0] * 100) / 100 : null,
      date, kind: contracts.every(contract => contract.status === 'PENDING_FIRST_CHARGE') ? 'FIRST_CHARGE' : 'DUE_CHARGE' });
  }
  const summarizeRows = list => ({ count: list.length,
    amount: list.reduce((sum, row) => sum + (row.amount === null ? 0 : Math.round(row.amount * 100)), 0) / 100,
    unknownAmountCount: list.filter(row => row.amount === null).length, rows: list });
  return { current: summarizeRows(rows), monthly: summarizeRows(rows.filter(row => row.date?.startsWith(`${today.slice(0, 7)}-`))),
    otherPeriodCount: rows.filter(row => !row.date?.startsWith(`${today.slice(0, 7)}-`)).length };
}

export function financeSummary(payments = [], users = [], now = new Date()) {
  const today = clubDate(now), month = today.slice(0, 7);
  const real = uniquePayments(payments.filter(payment => !isTestPayment(payment)));
  const monthly = real.filter(payment => {
    const date = financePaymentDate(payment);
    return date?.startsWith(`${month}-`) && date <= today;
  });
  const pendingSeries = new Map(), failedSeries = new Set();
  for (const user of users) for (const [type, contract] of Object.entries(user.recurringMemberships || {})) {
    if (contract.cancelledAt || contract.isMock || !validReminderDate(contract.endsAt) || contract.endsAt <= today) continue;
    const key = contract.seriesId ? `series:${String(contract.seriesId).toLowerCase()}` : contract.orderId ? `order:${contract.orderId}` : `member:${user.id}:${type}`;
    if (contract.status === 'PAYMENT_FAILED') failedSeries.add(key);
    else if (contract.status === 'PENDING_FIRST_CHARGE' || (contract.status === 'ACTIVE' && (!validReminderDate(contract.paidUntil) || contract.paidUntil <= today))) {
      if (!pendingSeries.has(key)) pendingSeries.set(key, []);
      pendingSeries.get(key).push({ name: user.name || user.id, contract });
    }
  }
  // A shared family instruction is one instruction, never one per beneficiary.
  const pendingRecurring = pendingInstructions(pendingSeries, failedSeries, real, today);
  return { month, today, monthly: summarize(monthly), lifetime: summarize(real),
    pendingRecurring, pendingRecurringCount: pendingRecurring.current.count, failedRecurringCount: failedSeries.size,
    excludedTestCount: payments.filter(isTestPayment).length,
    unassignedDateCount: real.filter(payment => !financePaymentDate(payment)).length };
}
