import { clubDate } from '../shared/membership-calendar.js';

// Persistent per-request claims bound traffic across restarts and multiple
// processes. No timer failure, timeout or absent receipt revokes access.
export async function reconcileRecurringDaily(store, env, inspect, now = new Date()) {
  if (!store || !env.PAYMENT_SIGNING_SECRET || !env.PUBLIC_APP_URL) return;
  const day = clubDate(now);
  const started = Date.now(); let checked = 0;
  for (const club of await store.getAllClubStates()) {
    // The process has one merchant configuration. Never use it for another club.
    if (club.club_id !== (env.CLUB_ID || 'baly-wellness')) continue;
    const checkouts = club.payload.recurringCheckouts || [];
    const offset = checkouts.length ? (Math.floor(now.getTime() / 60_000) * 20) % checkouts.length : 0;
    for (const checkout of [...checkouts.slice(offset), ...checkouts.slice(0, offset)]) {
      if (checked >= 20 || Date.now() - started >= 45_000) return;
      if (checkout.cancelledAt || checkout.endsAt <= day || (!checkout.orderSnapshot && !checkout.recurringSaleId)
        || (checkout.stage === 'RESERVED' && !checkout.recurringSaleId)
        || !club.payload.users?.some(user => user.id === checkout.userId)) continue;
      const age = now.getTime() - Date.parse(checkout.dispatchedAt);
      const contract = club.payload.users.flatMap(user => Object.values(user.recurringMemberships || {})).find(item => item.orderId === checkout.orderId);
      const awaitingSetup = !contract && Number.isFinite(age) && age >= 0 && age < 24 * 60 * 60_000;
      const interval = age < 10 * 60_000 ? 60_000 : 15 * 60_000;
      const key = awaitingSetup ? `recurring-setup:${Math.floor(now.getTime() / interval)}:${interval}:${checkout.orderId}`
        : `recurring-check:${day}:${checkout.orderId}`;
      if (!await store.claimPushDelivery(club.club_id, key)) continue;
      checked++;
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
  const timer = setInterval(run, 60_000);
  timer.unref?.();
  return timer;
}
