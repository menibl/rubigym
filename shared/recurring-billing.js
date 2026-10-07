// A recurring contract is deliberately separate from the price's time unit.
// Old MONTHLY plans stay one-off; choosing an annual monthly commitment opts in.
export function recurringPlan(plan) {
  if (plan?.paymentMode) return plan.paymentMode === 'RECURRING';
  return plan?.billingPeriod === 'MONTHLY_ANNUAL_COMMITMENT';
}

export function recurringSchedule(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(now).map(part => [part.type, part.value]));
  const year = Number(parts.year), month = Number(parts.month);
  const end = new Date(Date.UTC(year, month + 11, 1));
  return {
    start: `${parts.day}-${parts.month}-${parts.year}`,
    endsAt: end.toISOString().slice(0, 10),
    fields: {
      SaleType: 2, CreateRecurringSale: true, RecurringSaleCycle: 3,
      RecurringSaleDay: 1, RecurringSaleStep: 1, RecurringSaleCount: 12,
      RecurringSaleStartDate: `${parts.day}-${parts.month}-${parts.year}`,
      RecurringSaleAutoCharge: true, RecurringSaleProRata: false
    }
  };
}

export function recurringReceipt(sale) {
  const id = String(sale?.RecurringId || sale?.RecurringSaleId || '');
  const charge = Number(sale?.RecurringSaleChargeNumber);
  const status = Number(sale?.TransactionStatus);
  const param = Number(sale?.TransactionParamJ);
  if (!id || !Number.isInteger(charge) || charge < 0 || charge > 12 || status !== 0) {
    throw new Error('INVALID_RECURRING_RECEIPT');
  }
  if (charge === 0 && param === 5) return { id, charge, paid: false };
  if (charge > 0 && param === 0) return { id, charge, paid: true };
  throw new Error('INVALID_RECURRING_RECEIPT');
}
