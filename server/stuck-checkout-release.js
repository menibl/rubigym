import { verifiedUnrelatedSeries } from './checkout-continuation.js';

const fail = (code = 'STUCK_CHECKOUT_REVIEW_REQUIRED') => { throw Object.assign(new Error(code), { code }); };
const phone = value => String(value || '').replace(/\D/g, '').replace(/^00972/, '0').replace(/^972/, '0');
const uuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value));

// A phone-wide hit is not necessarily this child's purchase. Exclude only a
// uniquely bound, already verified instruction of the SAME payer, for different
// beneficiaries still linked to that payer's family. Names/amounts are not proof.
function unrelatedFamilySeries(payload, item, seriesId) {
  const order = item.orderSnapshot;
  if (!order || order.o !== item.orderId || order.rc !== 1 || order.m !== item.membershipType
    || order.re !== item.endsAt || (order.bu || order.u) !== item.userId) return false;
  const payer = payload.users?.find(user => user.id === order.u && user.role === 'TRAINEE' && user.isFamilyPayer === true && user.familyId);
  if (!payer || !verifiedUnrelatedSeries(payload, order, seriesId)) return false;
  const other = payload.recurringCheckouts.find(row => !row.cancelledAt && String(row.recurringSaleId || '').toLowerCase() === seriesId.toLowerCase());
  const targets = order.gp || [{ memberId: order.bu || order.u }];
  const existing = other.orderSnapshot.gp || [{ memberId: other.orderSnapshot.bu || other.orderSnapshot.u }];
  const belongs = line => {
    const user = payload.users.find(user => user.id === line.memberId);
    return user?.role === 'TRAINEE' && (user.id === payer.id || (user.familyPayerId === payer.id && user.familyId === payer.familyId));
  };
  return targets.length > 0 && existing.length > 0 && [...targets, ...existing].every(belongs)
    && !targets.some(line => existing.some(otherLine => otherLine.memberId === line.memberId));
}

// Negative provider search is not proof that a hosted page cannot still charge.
// Release additionally requires the manager's explicit, audited provider evidence.
export function releaseContext(payload, userId, orderId) {
  const item = payload.recurringCheckouts?.find(row => row.userId === userId && row.orderId === orderId);
  const user = payload.users?.find(row => row.id === userId && row.role === 'TRAINEE');
  if (!item || !user) fail('STUCK_REQUEST_MISSING');
  if (item.cancelledAt) fail('STUCK_ALREADY_RELEASED');
  if (item.recurringSaleId) fail('STUCK_LINKED_SERIES');
  const targets = new Set([userId, item.orderSnapshot?.u, ...(item.orderSnapshot?.gp || []).map(line => line.memberId)].filter(Boolean));
  if ((payload.payments || []).some(row => row.recurringOrderId === orderId)
    || (payload.users || []).some(row => Object.values(row.recurringMemberships || {}).some(contract => contract.orderId === orderId))) fail('STUCK_LOCAL_PAYMENT_OR_CONTRACT');
  const people = payload.users.filter(row => targets.has(row.id));
  if (people.length !== targets.size) fail('STUCK_OWNER_MISSING');
  for (const person of [...people]) {
    const payer = payload.users.find(row => row.id === person.familyPayerId);
    if (payer && !people.some(row => row.id === payer.id)) people.push(payer);
  }
  const phones = [...new Set(people.map(row => phone(row.phone)).filter(value => /^0\d{8,9}$/.test(value)))].sort();
  if (!phones.length || phones.length > 6) fail('STUCK_PHONE_MISSING');
  // Freeze identity and the original request, not incidental unrelated club revisions.
  const unrelatedSeriesIds = [...new Set((payload.recurringCheckouts || []).map(row => String(row.recurringSaleId || '').toLowerCase())
    .filter(id => uuid(id) && unrelatedFamilySeries(payload, item, id)))].sort();
  // Recomputed before every CAS write: loss of verified family ownership or
  // contract evidence invalidates the manager's preview instead of releasing.
  return { item, phones, unrelatedSeriesIds, fingerprint: JSON.stringify({ item, unrelatedSeriesIds,
    people: people.map(row => ({ id: row.id, phone: row.phone, familyPayerId: row.familyPayerId })).sort((a, b) => a.id.localeCompare(b.id)) }) };
}

const completed = row => ['PAID', 'SETUP', 'EXISTING_RECURRING', 'ALREADY_PAID', 'CANCELLED'].includes(row.status);
async function splitContext(context, readSplit) {
  const { bs, bi, u } = context.item.orderSnapshot || {};
  if (!bs) return context;
  if (!readSplit || !bi || !u) fail('STUCK_SPLIT_STORAGE_REQUIRED');
  const record = await readSplit(u), batch = record?.payload;
  const line = batch?.items?.find(row => row.id === bi);
  if (!batch || batch.id !== bs || batch.payerId !== u || !line || line.memberId !== context.item.userId) fail('STUCK_SPLIT_MISMATCH');
  if (line.status === 'DISPATCHING') fail('STUCK_SPLIT_IN_PROGRESS');
  if (line.recurringSaleId || ['PAID', 'SETUP', 'EXISTING_RECURRING', 'ALREADY_PAID'].includes(line.status)) fail('STUCK_SPLIT_COMPLETED');
  if (line.status === 'CANCELLED' && line.releasedOrderId !== context.item.orderId) fail('STUCK_SPLIT_MISMATCH');
  return { ...context, split: { batch, line, revision: record.revision, payerId: u },
    fingerprint: `${context.fingerprint}:${JSON.stringify(line)}` };
}

export async function checkStuckCheckout({ payload, userId, orderId, groupToken, post, readSplit }) {
  if (!groupToken) fail('STUCK_MERCHANT_MISSING');
  const context = await splitContext(releaseContext(payload, userId, orderId), readSplit);
  for (const number of context.phones) {
    const result = await post('/RecurringSaleList', { GroupPrivateToken: groupToken, PhoneNumber: number });
    const invalidStatus = value => value === null || value === '' || typeof value === 'boolean' || Number(value) !== 0;
    if (!result || (result.Status !== undefined && invalidStatus(result.Status))
      || (result.error_code !== undefined && invalidStatus(result.error_code))) fail('STUCK_PROVIDER_UNAVAILABLE');
    const rows = (result.data || result.Data || result).RecurringSales;
    const list = Array.isArray(rows) ? rows : rows && typeof rows === 'object' ? [rows] : null;
    if (!list || list.length > 100 || list.some(row => !uuid(row?.RecurringSaleId) || typeof row.IsActive !== 'boolean')
      || new Set(list.map(row => row.RecurringSaleId.toLowerCase())).size !== list.length) fail('STUCK_PROVIDER_LIST_INVALID');
    if (list.some(row => row.IsActive && !context.unrelatedSeriesIds.includes(row.RecurringSaleId.toLowerCase()))) fail('STUCK_ACTIVE_SERIES_FOR_OWNER');
  }
  return context;
}

export async function releaseStuckCheckout(store, clubId, userId, orderId, evidence, fingerprint) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const state = await store.getClubState(clubId);
    const context = await splitContext(releaseContext(state.payload, userId, orderId),
      store.getFamilySplitCheckout ? payerId => store.getFamilySplitCheckout(clubId, payerId) : undefined);
    if (context.fingerprint !== fingerprint) fail('STUCK_REQUEST_CHANGED');
    let releaseSplitCoupon = false;
    if (context.split) {
      if (!store.putFamilySplitCheckout) fail('STUCK_SPLIT_STORAGE_REQUIRED');
      const { batch, line, revision, payerId } = context.split;
      const next = { ...batch, items: batch.items.map(row => row.id === line.id ? { ...row,
        status: 'CANCELLED', releasedOrderId: orderId, cancelledAt: evidence.releasedAt, cancelledBy: evidence.managerId } : row) };
      // Disable only this journal item FIRST. A concurrent dispatch/rewrite wins
      // by CAS; partial failure stays blocked and can be reviewed again safely.
      if (line.status !== 'CANCELLED' && !await store.putFamilySplitCheckout(clubId, payerId, next, revision)) fail('STUCK_REQUEST_CHANGED');
      releaseSplitCoupon = next.items.every(completed);
    }
    const payload = { ...state.payload,
      recurringCheckouts: state.payload.recurringCheckouts.map(row => row.orderId === orderId ? {
        ...row, cancelledAt: evidence.releasedAt, cancelledBy: evidence.managerId, stage: 'RELEASED_MANAGER_REVIEW',
        releaseReason: evidence.reason, releaseEvidence: { providerReference: evidence.providerReference,
          oldPageUnusableAttested: true, noChargeOrInstructionAttested: true,
          providerListCheckedAt: evidence.releasedAt,
          verifiedUnrelatedSeriesIds: context.unrelatedSeriesIds,
          evidenceSource: context.unrelatedSeriesIds.length ? 'MANAGER_ATTESTATION_WITH_SCOPED_PROVIDER_LIST' : 'MANAGER_ATTESTATION_WITH_NEGATIVE_PROVIDER_LIST' }
      } : row),
      discountCodes: (state.payload.discountCodes || []).map(row => !row.isUsed && (row.reservedRecurringOrderId === orderId
        || (releaseSplitCoupon && row.reservedFamilySplitId === context.item.orderSnapshot.bs))
        ? { ...row, reservedRecurringOrderId: row.reservedRecurringOrderId === orderId ? undefined : row.reservedRecurringOrderId,
          reservedFamilySplitId: releaseSplitCoupon && row.reservedFamilySplitId === context.item.orderSnapshot?.bs ? undefined : row.reservedFamilySplitId } : row) };
    if (!(await store.putClubState(clubId, payload, state.revision)).conflict) return;
  }
  fail('STUCK_REQUEST_CHANGED');
}
