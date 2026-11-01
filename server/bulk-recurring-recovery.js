import { clubDate } from '../shared/membership-calendar.js';
import { recurringId, recurringSyncIdentity, prepareRecurringIdSync } from './recurring-id-sync.js';

const phone = value => String(value || '').replace(/\D/g, '').replace(/^00972/, '0').replace(/^972/, '0');
const validPhone = value => /^0\d{8,9}$/.test(value);
const reject = code => { const error = new Error(code); error.code = code; throw error; };
const parseList = result => {
  if (!result || (result.Status !== undefined && Number(result.Status) !== 0)
    || (result.error_code !== undefined && Number(result.error_code) !== 0)) reject('PROVIDER_LIST_UNAVAILABLE');
  const rows = (result.data || result.Data || result).RecurringSales;
  const list = Array.isArray(rows) ? rows : rows && typeof rows === 'object' ? [rows] : null;
  if (!list || list.length > 100 || list.some(item => !recurringId(item?.RecurringSaleId) || typeof item.IsActive !== 'boolean')) reject('PROVIDER_LIST_INVALID');
  return [...new Set(list.filter(item => item.IsActive).map(item => recurringId(item.RecurringSaleId)))].sort();
};

// Discovery is read-only. Never guess by name/email or let a matching amount
// substitute for the existing owned order, phone, merchant and schedule checks.
export async function discoverTodayRecurring({ payload, post, appUrl, groupToken, now = new Date(), requestBudget = Infinity, recentOnly = false, priorityOrderId }) {
  const day = clubDate(now);
  const checkouts = (payload.recurringCheckouts || []).filter(item => !item.cancelledAt
    && Number.isFinite(Date.parse(item.dispatchedAt)) && (recentOnly
      ? Date.parse(item.dispatchedAt) <= now.getTime() && now.getTime() - Date.parse(item.dispatchedAt) < 24 * 60 * 60_000
      : clubDate(new Date(item.dispatchedAt)) === day))
    .sort((a, b) => Number(b.orderId === priorityOrderId) - Number(a.orderId === priorityOrderId) || String(a.orderId).localeCompare(String(b.orderId)));
  if (checkouts.length > 50) reject('RECOVERY_BATCH_TOO_LARGE');
  if (checkouts.length && !groupToken) reject('RECURRING_PAGE_NOT_CONFIGURED');
  const lists = new Map(), detailsCache = new Map(), historyCache = new Map();
  const started = Date.now();
  let requests = 0;
  const read = async (path, body) => {
    if (Date.now() - started > 60_000) reject('RECOVERY_TIME_LIMIT');
    if (++requests > requestBudget) reject('RECOVERY_REQUEST_LIMIT');
    return post(path, body);
  };
  const cached = (cache, key, load) => {
    if (!cache.has(key)) cache.set(key, Promise.resolve().then(load));
    return cache.get(key);
  };
  const entries = [];
  for (const checkout of checkouts) {
    const user = payload.users?.find(item => item.id === checkout.userId && item.role === 'TRAINEE');
    const entry = { orderId: checkout.orderId, userId: checkout.userId, name: user?.name || 'מתאמן לא זמין', status: 'REVIEW', code: 'NO_VERIFIED_MATCH' };
    entries.push(entry);
    const payerId = checkout.orderSnapshot?.u || user?.familyPayerId || user?.id;
    const payer = payload.users.find(item => item.id === payerId);
    const numbers = [...new Set([payer?.phone, user?.phone].map(phone).filter(validPhone))];
    entry.phoneScope = numbers;
    entry.originalAmount = checkout.orderSnapshot?.a;
    if (!user || !checkout.orderSnapshot) { entry.code = 'ORIGINAL_ORDER_MISSING'; continue; }
    if (!numbers.length) { entry.code = 'PHONE_MISSING'; continue; }
    const candidates = new Set(); let unavailable = false;
    for (const number of numbers) {
      try {
        const ids = await cached(lists, number, async () => parseList(await read('/RecurringSaleList', { GroupPrivateToken: groupToken, PhoneNumber: number })));
        ids.forEach(id => candidates.add(id));
      } catch { unavailable = true; }
    }
    // A partial search must never turn ambiguity into an apparent unique match.
    if (unavailable) { entry.code = 'PROVIDER_LIST_UNAVAILABLE'; continue; }
    const matches = [];
    for (const seriesId of [...candidates].sort()) {
      if (detailsCache.size >= 200 && !detailsCache.has(seriesId)) { unavailable = true; break; }
      let details;
      try { details = await cached(detailsCache, seriesId, () => read('/RecurringSaleDetails', { RecurringSaleId: seriesId })); }
      catch { unavailable = true; continue; }
      try {
        const identity = recurringSyncIdentity({ payload, userId: user.id, seriesId, details, appUrl, now });
        if (identity.checkout.orderId === checkout.orderId) {
          const approved = identity.details;
          if (!(typeof approved.Token === 'string' && approved.Token.trim())
            && !(String(approved.AuthNum || '').trim() && String(approved.CardNum || '').trim())) {
            unavailable = true; continue;
          }
          matches.push({ seriesId, details });
        }
      } catch (error) {
        if (['RIVHIT_SYNC_PROVIDER_RESPONSE', 'RIVHIT_CREATION_DATE_FORMAT', 'RIVHIT_END_DATE_FORMAT'].includes(error?.code)) unavailable = true;
        // Definite ownership/schedule/amount mismatches are not candidates.
      }
    }
    if (unavailable) { entry.code = 'PROVIDER_DETAILS_UNAVAILABLE'; continue; }
    if (matches.length !== 1) { entry.code = matches.length ? 'AMBIGUOUS_SERIES' : 'NO_VERIFIED_MATCH'; continue; }
    const { seriesId, details } = matches[0];
    let history;
    try { history = await cached(historyCache, seriesId, () => read('/RecurringSaleHistory', { RecurringSaleId: seriesId })); }
    catch { history = null; }
    try {
      const prepared = prepareRecurringIdSync({ payload, userId: user.id, seriesId, details, history, appUrl, now });
      Object.assign(entry, { status: 'VERIFIED', code: 'VERIFIED', seriesId, prepared,
        provider: { details, history } });
    } catch { entry.code = 'HISTORY_OR_TERMS_REQUIRE_REVIEW'; }
  }
  // One provider instruction cannot satisfy two independent app orders, even
  // if a shared family phone and amount happen to match. A signed group is one order.
  const unresolved = entries.filter(item => item.status !== 'VERIFIED');
  for (const entry of entries) if (entry.status === 'VERIFIED' && unresolved.some(other =>
    other.phoneScope.some(number => entry.phoneScope.includes(number))
      && (other.originalAmount === undefined || Number(other.originalAmount) === Number(entry.originalAmount)))) {
    entry.status = 'REVIEW'; entry.code = 'AMBIGUOUS_PEER_ORDER'; delete entry.prepared; delete entry.provider;
  }
  const counts = new Map();
  entries.filter(item => item.status === 'VERIFIED').forEach(item => counts.set(item.seriesId, (counts.get(item.seriesId) || 0) + 1));
  for (const entry of entries) if (entry.status === 'VERIFIED' && counts.get(entry.seriesId) > 1) {
    entry.status = 'REVIEW'; entry.code = 'SERIES_MATCHES_MULTIPLE_ORDERS'; delete entry.prepared; delete entry.provider;
  }
  return { day, entries };
}

export const publicRecovery = recovery => ({ day: recovery.day, items: recovery.entries.map(item => ({
  orderId: item.orderId, name: item.name, status: item.status, code: item.code,
  ...(item.prepared ? { plan: item.prepared.preview.planLabel, amount: item.prepared.preview.amount,
    charges: item.prepared.payments.length, endsAt: item.prepared.preview.endsAt } : {})
})) });
