import { clubDate } from '../shared/membership-calendar.js';

const context = (clubId, orderId) => new TextEncoder().encode(JSON.stringify({ clubId, orderId }));
const keyFor = async secret => crypto.subtle.importKey('raw', await crypto.subtle.digest('SHA-256',
  new TextEncoder().encode(`baly-recurring-checkout-v1:${secret}`)), 'AES-GCM', false, ['encrypt', 'decrypt']);
const to64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const from64 = value => Uint8Array.from(atob(value), character => character.charCodeAt(0));

// Provider continuation capabilities never belong in shared club JSON, account
// profiles, logs or public state. Store only authenticated ciphertext in SQL.
export async function saveRecurringContinuation(store, secret, clubId, orderId, userId, checkout) {
  if (!store.saveRecurringContinuation || !secret) throw new Error('RECURRING_CONTINUATION_STORAGE_REQUIRED');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: context(clubId, orderId) },
    await keyFor(secret), new TextEncoder().encode(JSON.stringify(checkout)));
  await store.saveRecurringContinuation(clubId, orderId, userId, `v1.${to64(iv)}.${to64(encrypted)}`);
}

export async function readRecurringContinuation(store, secret, clubId, orderId, userId) {
  const row = await store.getRecurringContinuation?.(clubId, orderId);
  if (!row) return null;
  if (row.user_id !== userId || typeof row.encrypted_checkout !== 'string' || row.encrypted_checkout.length > 100000) throw new Error('RECURRING_CONTINUATION_INVALID');
  try {
    const [version, iv, body] = row.encrypted_checkout.split('.');
    if (version !== 'v1') throw new Error();
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: from64(iv), additionalData: context(clubId, orderId) }, await keyFor(secret), from64(body));
    return JSON.parse(new TextDecoder().decode(plain));
  } catch { throw new Error('RECURRING_CONTINUATION_INVALID'); }
}

export const openRecurringCheckout = (payload, userId, type) => (payload.recurringCheckouts || []).find(item =>
  ((item.userId === userId && (!item.membershipType || item.membershipType === type))
    || item.orderSnapshot?.gp?.some(line => line.memberId === userId && line.membershipType === type)) && !item.cancelledAt
    && (item.endsAt > clubDate() || !item.recurringSaleId));

export async function updateRecurringCheckout(store, clubId, orderId, transform) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const state = await store.getClubState(clubId);
    const previous = state?.payload?.recurringCheckouts?.find(item => item.orderId === orderId);
    if (!previous) throw new Error('RECURRING_CHECKOUT_MISSING');
    const next = transform(previous, state.payload);
    if (!next) return false;
    const payload = { ...state.payload, recurringCheckouts: state.payload.recurringCheckouts.map(item => item.orderId === orderId ? next : item) };
    const saved = await store.putClubState(clubId, payload, state.revision);
    if (!saved.conflict) return true;
  }
  throw new Error('PAYMENT_STATE_CONFLICT');
}

export async function releaseUndispatchedRecurringCheckout(store, clubId, userId, orderId, managerId, reason, now = Date.now()) {
  if (!store.getRecurringContinuation) return false;
  for (let attempt = 0; attempt < 5; attempt++) {
    const state = await store.getClubState(clubId);
    const item = state?.payload?.recurringCheckouts?.find(record => record.orderId === orderId && record.userId === userId);
    // No timeout-based release of legacy or possibly-dispatched requests.
    if (!item || item.cancelledAt || item.stage !== 'RESERVED' || item.requestDispatchedAt || item.recurringSaleId
      || !(now - Date.parse(item.dispatchedAt) > 5 * 60000) || await store.getRecurringContinuation?.(clubId, orderId)
      || state.payload.payments?.some(payment => payment.recurringOrderId === orderId)
      || Object.values(state.payload.users?.find(user => user.id === userId)?.recurringMemberships || {}).some(contract => contract.orderId === orderId)) return false;
    const payload = { ...state.payload, recurringCheckouts: state.payload.recurringCheckouts.map(record => record === item
      ? { ...record, cancelledAt: new Date(now).toISOString(), cancelledBy: managerId, releaseReason: reason, stage: 'RELEASED_UNDISPATCHED' } : record),
      discountCodes: (state.payload.discountCodes || []).map(code => !code.isUsed && code.reservedRecurringOrderId === orderId
        ? { ...code, reservedRecurringOrderId: undefined } : code) };
    const saved = await store.putClubState(clubId, payload, state.revision);
    if (!saved.conflict) return true;
  }
  throw new Error('PAYMENT_STATE_CONFLICT');
}
