import { uniquePayments } from '../shared/payment-ledger.js';
import { isTestPayment } from '../shared/admin-trainees.js';

// A stable manifest of server-owned references, never a name/amount match.
// Each task is processed in a separate bounded request, without provider writes.
export function financeSyncTasks(payload) {
  const tasks = [], series = new Set();
  for (const checkout of payload.recurringCheckouts || []) {
    if (checkout.cancelledAt) continue;
    const key = checkout.recurringSaleId || checkout.orderId;
    if (!key || series.has(key)) continue;
    series.add(key);
    tasks.push({ id: `order:${checkout.orderId}`, kind: 'RECURRING', orderId: checkout.orderId,
      name: payload.users?.find(user => user.id === checkout.userId)?.name || 'בקשת תשלום' });
  }
  for (const user of payload.users || []) for (const contract of Object.values(user.recurringMemberships || {})) {
    if (!contract.seriesId || contract.cancelledAt || series.has(contract.seriesId)) continue;
    series.add(contract.seriesId);
    tasks.push({ id: `series:${contract.seriesId}`, kind: 'UNLINKED', name: user.name });
  }
  for (const payment of uniquePayments(payload.payments || [])) {
    if (isTestPayment(payment) || payment.status === 'REFUNDED' || payment.providerRecurringSaleId
      || !(payment.provider === 'RIVHIT' || String(payment.id).startsWith('payment-rivhit-'))) continue;
    tasks.push({ id: `payment:${payment.id}`, kind: 'PAYMENT', paymentId: payment.id, name: payment.traineeName || 'עסקה' });
  }
  return tasks;
}
