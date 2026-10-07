// Stable provider identifiers only: equal names, dates, amounts or card digits
// are never sufficient evidence that two purchases are the same transaction.
export function paymentIdentifiers(payment) {
  const namespace = `${payment.isMock ? 'test' : 'live'}:${payment.provider || (String(payment.id).startsWith('payment-rivhit-') ? 'RIVHIT' : 'other')}:`;
  return [payment.providerSaleId, payment.providerTransactionId, payment.paymentReference,
    String(payment.id || '').replace(/^payment-rivhit-/, '')]
    .filter(value => typeof value === 'string' && value.trim())
    .map(value => namespace + value);
}

export function sameProviderPayment(a, b) {
  if (a.id === b.id) return true;
  const ids = new Set(paymentIdentifiers(a));
  return paymentIdentifiers(b).some(id => ids.has(id));
}

export function uniquePayments(payments) {
  const groups = [];
  for (const payment of payments) {
    const matches = groups.filter(group => group.some(existing => sameProviderPayment(existing, payment)));
    if (!matches.length) groups.push([payment]);
    else {
      const combined = [payment, ...matches.flat()];
      for (const match of matches) groups.splice(groups.indexOf(match), 1);
      groups.push(combined);
    }
  }
  return groups.map(group => {
    const ranked = [...group].sort((a, b) => {
      const score = p => (p.status === 'REFUNDED' ? 100 : 0) + (p.providerSaleId ? 4 : 0) + (p.providerTransactionId ? 2 : 0) + (/••••/.test(p.paymentMethod || '') ? 1 : 0);
      return score(b) - score(a);
    });
    return ranked.reduce((result, payment) => {
      for (const [key, value] of Object.entries(payment)) if (result[key] == null || result[key] === '') result[key] = value;
      return result;
    }, { ...ranked[0] });
  }).sort((a, b) => String(b.timestamp || b.date).localeCompare(String(a.timestamp || a.date)));
}
