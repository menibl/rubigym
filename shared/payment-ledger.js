const normalized = value => String(value || '').trim().toLowerCase();
const isRivhit = payment => payment.provider === 'RIVHIT' || /^payment-rivhit-/.test(payment.id || '') || /^RIVHIT iCredit/.test(payment.paymentMethod || '');
const legacyId = payment => /^payment-rivhit-/.test(payment.id || '') ? normalized(payment.id.slice(15)) : '';
const transaction = payment => {
  const value = normalized(payment.providerTransactionId);
  return value && value !== normalized(payment.providerSaleId) ? value : '';
};

// Same name, price, plan or date is NEVER transaction identity. Different real
// transaction IDs under one sale (e.g. recurring charges) remain separate.
export function samePayment(a, b) {
  if (!a || !b || a.traineeId !== b.traineeId || Boolean(a.isMock) !== Boolean(b.isMock)) return false;
  if (a.id && a.id === b.id) return true;
  if (!isRivhit(a) || !isRivhit(b)) return false;
  if (transaction(a) && transaction(b)) return transaction(a) === transaction(b);
  const left = [normalized(a.providerSaleId), normalized(a.providerTransactionId), legacyId(a)].filter(Boolean);
  const right = [normalized(b.providerSaleId), normalized(b.providerTransactionId), legacyId(b)].filter(Boolean);
  return left.some(id => right.includes(id));
}

export function mergePaymentEvidence(existing, incoming) {
  const result = { ...existing };
  for (const field of ['provider', 'providerSaleId', 'providerRecurringSaleId']) {
    if (!result[field] && incoming[field]) result[field] = incoming[field];
  }
  if (transaction(incoming) || !result.providerTransactionId) result.providerTransactionId = incoming.providerTransactionId || result.providerTransactionId;
  if (!/\d{4}$/.test(result.paymentMethod || '') && /\d{4}$/.test(incoming.paymentMethod || '')) result.paymentMethod = incoming.paymentMethod;
  if (incoming.status === 'REFUNDED') {
    for (const field of ['status', 'refundedAt', 'refundedBy', 'refundReason', 'refundDocumentLink']) if (incoming[field] !== undefined) result[field] = incoming[field];
  }
  return result;
}

// A read-only report projection: original rows stay intact for audit and credit
// claim references. Conflicting amounts are left visible for investigation.
export function paymentReport(payments = []) {
  const groups = [];
  for (const payment of payments) {
    const group = groups.find(item => item.rows.every(row => Number(row.amount) === Number(payment.amount) && samePayment(row, payment)));
    if (group) { group.rows.push(payment); group.payment = mergePaymentEvidence(group.payment, payment); }
    else groups.push({ rows: [payment], payment: { ...payment } });
  }
  return groups.map(group => group.payment);
}
