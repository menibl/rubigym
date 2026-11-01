import { clubDate } from '../shared/membership-calendar.js';

// Persistent per-request claims bound traffic across restarts and multiple
// processes. No timer failure, timeout or absent receipt revokes access.
export async function reconcileRecurringDaily(store, env, inspect, now = new Date()) {
  if (!store || !env.PAYMENT_SIGNING_SECRET || !env.PUBLIC_APP_URL) return;
  const day = clubDate(now);
  for (const club of await store.getAllClubStates()) {
    // The process has one merchant configuration. Never use it for another club.
    if (club.club_id !== (env.CLUB_ID || 'baly-wellness')) continue;
    for (const checkout of club.payload.recurringCheckouts || []) {
      if (checkout.cancelledAt || checkout.endsAt <= day || (!checkout.orderSnapshot && !checkout.recurringSaleId)
        || (checkout.stage === 'RESERVED' && !checkout.recurringSaleId)
        || !club.payload.users?.some(user => user.id === checkout.userId)) continue;
      if (!await store.claimPushDelivery(club.club_id, `recurring-check:${day}:${checkout.orderId}`)) continue;
      try {
        const providerFetch = typeof env.RIVHIT_FETCH === 'function' ? env.RIVHIT_FETCH : fetch;
        await inspect({ ...env, STATE_STORE: store, CLUB_ID: club.club_id,
          RIVHIT_FETCH: (url, options) => providerFetch(url, { ...options, signal: AbortSignal.timeout(15_000) }) }, checkout);
      } catch (error) {
        // Never log provider bodies, personal details or continuation tokens.
        console.warn('RIVHIT daily reconciliation deferred', {
          operation: error?.diagnostic?.operation || 'RecurringVerification',
          code: /^[A-Z_]{3,80}$/.test(error?.code || '') ? error.code : 'REVIEW_REQUIRED'
        });
      }
    }
  }
}

export function startRecurringReconciliation(store, env, inspect) {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try { await reconcileRecurringDaily(store, env, inspect); }
    catch { console.warn('RIVHIT daily reconciliation scheduler deferred'); }
    finally { running = false; }
  };
  void run();
  const timer = setInterval(run, 15 * 60_000);
  timer.unref?.();
  return timer;
}
