import { discoverTodayRecurring } from './bulk-recurring-recovery.js';
import { prepareRecurringIdSync } from './recurring-id-sync.js';

const cache = new WeakMap();
const stable = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);

// The same strict ownership/amount/calendar/card/history checks as manager
// recovery, with no manager click and no write/charge API calls. Never use a
// hosted page visit, missing receipt or closing the browser as approval.
export async function discoverApprovedSetup(env, order, post, now = new Date()) {
  if (!env.STATE_STORE || order.rc !== 1) return null;
  const clubId = env.CLUB_ID || 'baly-wellness';
  const state = await env.STATE_STORE.getClubState(clubId);
  let bucket = cache.get(env.STATE_STORE);
  if (!bucket || bucket.clubId !== clubId || now.getTime() - bucket.at >= 30_000) {
    const started = Date.now();
    bucket = { clubId, at: now.getTime(), result: discoverTodayRecurring({ payload: state.payload, post: (path, data) => {
      if (Date.now() - started > 7_000) throw new Error('RECOVERY_TIME_LIMIT');
      return post(path, data);
    }, appUrl: env.PUBLIC_APP_URL, groupToken: env.RIVHIT_RECURRING_GROUP_PRIVATE_TOKEN, now, requestBudget: 12, recentOnly: true, priorityOrderId: order.o }) };
    cache.set(env.STATE_STORE, bucket);
  }
  const found = (await bucket.result).entries.find(entry => entry.orderId === order.o && entry.status === 'VERIFIED');
  if (!found) return null;
  // Recheck against fresh club state after any cached lookup and before writes.
  const latest = await env.STATE_STORE.getClubState(clubId);
  const prepared = prepareRecurringIdSync({ payload: latest.payload, userId: order.bu || order.u,
    seriesId: found.seriesId, ...found.provider, appUrl: env.PUBLIC_APP_URL, now });
  if (stable(prepared.order) !== stable(order)) return null;
  return { order, payment: prepared.payments.at(-1) || { saleId: `setup-${found.seriesId}`, recurringSaleId: found.seriesId,
    recurringChargeNumber: 0, recurringPending: true, transactionId: `setup-${found.seriesId}` } };
}
