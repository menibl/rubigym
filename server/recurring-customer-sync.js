import { invoiceCustomerName } from '../shared/person-name.js';
import { recurringId } from './recurring-id-sync.js';

const phone = value => String(value || '').replace(/\D/g, '').replace(/^00972/, '0').replace(/^972/, '0');
const sameName = (a, b) => String(a || '').trim().replace(/\s+/g, ' ') === String(b || '').trim().replace(/\s+/g, ' ');
const succeeded = value => value && typeof value === 'object' && !Array.isArray(value)
  && ['Status', 'error_code'].every(key => value[key] === undefined || (typeof value[key] !== 'boolean' && value[key] !== null && value[key] !== '' && Number(value[key]) === 0));
const lastSync = (payload, id) => (payload.recurringCheckouts || []).find(item => recurringId(item.recurringSaleId) === id && item.customerNameSync)?.customerNameSync
  || (payload.users || []).flatMap(user => Object.values(user.recurringMemberships || {})).find(contract => recurringId(contract.seriesId) === id && contract.customerNameSync)?.customerNameSync;

// One invoice customer per provider series, including a combined family series.
// Names always belong to the original payer, never to whichever beneficiary
// happened to be visited last. Only persisted, bound instructions are eligible.
export function recurringCustomerTarget(payload, seriesId) {
  if (!recurringId(seriesId)) throw new Error('NAME_SYNC_INVALID_SERIES');
  const checkouts = (payload.recurringCheckouts || []).filter(item => recurringId(item.recurringSaleId) === seriesId && !item.cancelledAt);
  const owners = [...new Set(checkouts.map(item => item.orderSnapshot?.u).filter(Boolean))];
  if (owners.length !== 1 || checkouts.some(item => !item.orderSnapshot?.u || item.orderSnapshot.o !== item.orderId)) throw new Error('NAME_SYNC_OWNER_REVIEW');
  const payer = payload.users?.find(user => user.id === owners[0]);
  const customer = invoiceCustomerName(payload.users || [], owners[0]);
  if (!customer || customer.firstName.length > 20 || customer.lastName.length > 30) throw new Error('NAME_SYNC_FULL_NAME_REQUIRED');
  if (!/^0\d{8,9}$/.test(phone(payer.phone))) throw new Error('NAME_SYNC_OWNER_REVIEW');
  const contracts = (payload.users || []).flatMap(user => Object.values(user.recurringMemberships || {})
    .filter(contract => recurringId(contract.seriesId) === seriesId && !contract.cancelledAt));
  if (!contracts.length || contracts.some(contract => !checkouts.some(item => item.orderId === contract.orderId))) throw new Error('NAME_SYNC_BINDING_REVIEW');
  return { payerId: payer.id, customer, ownerPhone: phone(payer.phone) };
}

function providerDetails(response) {
  if (!succeeded(response)) throw new Error('NAME_SYNC_PROVIDER_UNAVAILABLE');
  const value = response.data || response.Data || response;
  const details = Array.isArray(value) ? value.length === 1 ? value[0] : null : value;
  if (!details || typeof details.CustomerFirstName !== 'string' || typeof details.CustomerLastName !== 'string'
    || typeof details.IsActive !== 'boolean') throw new Error('NAME_SYNC_PROVIDER_SHAPE');
  return details;
}

async function recordResult(store, clubId, seriesId, result, now, expectedName) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const state = await store.getClubState(clubId);
    if (!state) return;
    let currentName;
    try { currentName = recurringCustomerTarget(state.payload, seriesId).customer; } catch { /* show review rather than invent a name */ }
    const stale = expectedName && JSON.stringify(expectedName) !== JSON.stringify(currentName);
    const sync = { ...result, ...(stale ? { status: 'PENDING', code: 'NAME_SYNC_PROFILE_CHANGED' } : {}),
      checkedAt: now.toISOString(), nextAttemptAt: new Date(now.getTime() + (stale ? 60_000 : result.status === 'SYNCED' ? 24 * 60 * 60_000 : 15 * 60_000)).toISOString(),
      ...(expectedName && !stale && result.status === 'SYNCED' ? { name: `${expectedName.firstName} ${expectedName.lastName}` } : {}) };
    const payload = { ...state.payload, users: (state.payload.users || []).map(user => ({ ...user,
      recurringMemberships: user.recurringMemberships ? Object.fromEntries(Object.entries(user.recurringMemberships).map(([type, contract]) => [type,
        recurringId(contract.seriesId) === seriesId ? { ...contract, customerNameSync: sync } : contract])) : user.recurringMemberships })),
      recurringCheckouts: (state.payload.recurringCheckouts || []).map(item => recurringId(item.recurringSaleId) === seriesId
      ? { ...item, customerNameSync: sync } : item) };
    const saved = await store.putClubState(clubId, payload, state.revision);
    if (!saved.conflict) return;
  }
  throw new Error('NAME_SYNC_STATE_CONFLICT');
}

export function startRecurringCustomerNameSync(store, env, post) {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try { await reconcileRecurringCustomerNames(store, env, post); }
    catch { console.warn('RIVHIT recurring customer name sync deferred'); }
    finally { running = false; }
  };
  void run();
  const timer = setInterval(run, 60_000);
  timer.unref?.();
  return timer;
}

// This worker can ONLY read an existing series and update its two name fields.
// No payment/creation/token/amount/cancellation operation is accepted here.
export async function syncRecurringCustomerName(store, clubId, seriesId, post, now = new Date()) {
  let target;
  try {
    const state = await store.getClubState(clubId);
    target = recurringCustomerTarget(state?.payload || {}, seriesId);
    let details = providerDetails(await post('/RecurringSaleDetails', { RecurringSaleId: seriesId }));
    if (phone(details.PhoneNumber) !== target.ownerPhone) throw new Error('NAME_SYNC_OWNER_REVIEW');
    if (!details.IsActive) throw new Error('NAME_SYNC_INACTIVE');
    if (!sameName(details.CustomerFirstName, target.customer.firstName) || !sameName(details.CustomerLastName, target.customer.lastName)) {
      const previouslyVerified = lastSync(state.payload, seriesId)?.name;
      const providerName = `${details.CustomerFirstName} ${details.CustomerLastName}`;
      // A different person may have become the invoice customer directly at
      // iCredit. A phone match alone never authorizes reverting that transfer.
      if (!sameName(details.CustomerFirstName, target.customer.firstName)
        && (!previouslyVerified || !sameName(previouslyVerified, providerName))) throw new Error('NAME_SYNC_PROVIDER_NAME_REVIEW');
      const latest = await store.getClubState(clubId);
      const fresh = recurringCustomerTarget(latest.payload, seriesId);
      if (JSON.stringify(fresh) !== JSON.stringify(target)) throw new Error('NAME_SYNC_PROFILE_CHANGED');
      const result = await post('/RecurringSaleUpdateCustomer', { RecurringSaleId: seriesId,
        CustomerFirstName: target.customer.firstName, CustomerLastName: target.customer.lastName });
      if (!succeeded(result) || (result.Status === undefined && result.error_code === undefined)) throw new Error('NAME_SYNC_UPDATE_UNCONFIRMED');
      // A 200/Status=0 is not sufficient: verify what the provider stored.
      details = providerDetails(await post('/RecurringSaleDetails', { RecurringSaleId: seriesId }));
      if (phone(details.PhoneNumber) !== target.ownerPhone || !details.IsActive
        || !sameName(details.CustomerFirstName, target.customer.firstName) || !sameName(details.CustomerLastName, target.customer.lastName)) throw new Error('NAME_SYNC_UPDATE_UNCONFIRMED');
    }
    await recordResult(store, clubId, seriesId, { status: 'SYNCED' }, now, target.customer);
    return 'SYNCED';
  } catch (error) {
    const code = /^NAME_SYNC_[A-Z_]+$/.test(error?.message || '') ? error.message : 'NAME_SYNC_PROVIDER_UNAVAILABLE';
    await recordResult(store, clubId, seriesId, { status: code.endsWith('REVIEW') || code.endsWith('REQUIRED') || code.endsWith('INACTIVE') ? 'REVIEW_REQUIRED' : 'RETRY', code }, now, target?.customer);
    return code;
  }
}

export async function reconcileRecurringCustomerNames(store, env, post, now = new Date()) {
  if (!store?.withRecurringSeriesLock || !store.getAllClubStates || !env.RIVHIT_RECURRING_GROUP_PRIVATE_TOKEN) return;
  const started = Date.now(); let checked = 0;
  for (const club of await store.getAllClubStates()) {
    if (club.club_id !== (env.CLUB_ID || 'baly-wellness')) continue;
    const ids = [...new Set([
      ...(club.payload.recurringCheckouts || []).filter(item => !item.cancelledAt).map(item => recurringId(item.recurringSaleId)),
      ...(club.payload.users || []).flatMap(user => Object.values(user.recurringMemberships || {})).filter(contract => !contract.cancelledAt).map(contract => recurringId(contract.seriesId))
    ].filter(Boolean))];
    for (const id of ids) {
      if (checked >= 3 || Date.now() - started > 30_000) return;
      let desiredName;
      try { const { customer } = recurringCustomerTarget(club.payload, id); desiredName = `${customer.firstName} ${customer.lastName}`; } catch { /* persist an actionable review status */ }
      const last = lastSync(club.payload, id);
      if (last?.nextAttemptAt > now.toISOString() && (!desiredName || last.name === desiredName || last.status !== 'SYNCED')) continue;
      checked++;
      await store.withRecurringSeriesLock(club.club_id, id, async () => {
        // Another process might have completed this series while we waited.
        const fresh = await store.getClubState(club.club_id);
        const prior = lastSync(fresh.payload, id);
        if (prior?.status === 'SYNCED' && prior.name === desiredName && prior.nextAttemptAt > now.toISOString()) return;
        await syncRecurringCustomerName(store, club.club_id, id, (path, data) => post(path, data, env), now);
      });
    }
  }
}
