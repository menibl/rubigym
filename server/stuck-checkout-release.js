const fail = () => { throw new Error('STUCK_CHECKOUT_REVIEW_REQUIRED'); };
const phone = value => String(value || '').replace(/\D/g, '').replace(/^00972/, '0').replace(/^972/, '0');
const uuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value));

// Negative provider search is not proof that a hosted page cannot still charge.
// Release additionally requires the manager's explicit, audited provider evidence.
export function releaseContext(payload, userId, orderId) {
  const item = payload.recurringCheckouts?.find(row => row.userId === userId && row.orderId === orderId);
  const user = payload.users?.find(row => row.id === userId && row.role === 'TRAINEE');
  // Split checkout URLs are stored separately. Never leave a stale split page usable.
  if (!item || !user || item.cancelledAt || item.recurringSaleId || item.orderSnapshot?.bs) fail();
  const targets = new Set([userId, item.orderSnapshot?.u, ...(item.orderSnapshot?.gp || []).map(line => line.memberId)].filter(Boolean));
  if ((payload.payments || []).some(row => row.recurringOrderId === orderId)
    || (payload.users || []).some(row => Object.values(row.recurringMemberships || {}).some(contract => contract.orderId === orderId))) fail();
  const people = payload.users.filter(row => targets.has(row.id));
  if (people.length !== targets.size) fail();
  for (const person of [...people]) {
    const payer = payload.users.find(row => row.id === person.familyPayerId);
    if (payer && !people.some(row => row.id === payer.id)) people.push(payer);
  }
  const phones = [...new Set(people.map(row => phone(row.phone)).filter(value => /^0\d{8,9}$/.test(value)))].sort();
  if (!phones.length || phones.length > 5) fail();
  // Freeze identity and the original request, not incidental unrelated club revisions.
  return { item, phones, fingerprint: JSON.stringify({ item, people: people.map(row => ({ id: row.id, phone: row.phone, familyPayerId: row.familyPayerId })).sort((a, b) => a.id.localeCompare(b.id)) }) };
}

export async function checkStuckCheckout({ payload, userId, orderId, groupToken, post }) {
  if (!groupToken) fail();
  const context = releaseContext(payload, userId, orderId);
  for (const number of context.phones) {
    const result = await post('/RecurringSaleList', { GroupPrivateToken: groupToken, PhoneNumber: number });
    if (!result || (result.Status !== undefined && Number(result.Status) !== 0)
      || (result.error_code !== undefined && Number(result.error_code) !== 0)) fail();
    const rows = (result.data || result.Data || result).RecurringSales;
    const list = Array.isArray(rows) ? rows : rows && typeof rows === 'object' ? [rows] : null;
    // Any active instruction for these owners requires individual reconciliation,
    // not a guess based on names, amounts, partial lists or dates.
    if (!list || list.length > 100 || list.some(row => !uuid(row?.RecurringSaleId) || typeof row.IsActive !== 'boolean' || row.IsActive)) fail();
  }
  return context;
}

export async function releaseStuckCheckout(store, clubId, userId, orderId, evidence, fingerprint) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const state = await store.getClubState(clubId);
    const context = releaseContext(state.payload, userId, orderId);
    if (context.fingerprint !== fingerprint) fail();
    const payload = { ...state.payload,
      recurringCheckouts: state.payload.recurringCheckouts.map(row => row.orderId === orderId ? {
        ...row, cancelledAt: evidence.releasedAt, cancelledBy: evidence.managerId, stage: 'RELEASED_MANAGER_REVIEW',
        releaseReason: evidence.reason, releaseEvidence: { providerReference: evidence.providerReference,
          oldPageUnusableAttested: true, noChargeOrInstructionAttested: true,
          providerListCheckedAt: evidence.releasedAt, evidenceSource: 'MANAGER_ATTESTATION_WITH_NEGATIVE_PROVIDER_LIST' }
      } : row),
      discountCodes: (state.payload.discountCodes || []).map(row => !row.isUsed && row.reservedRecurringOrderId === orderId
        ? { ...row, reservedRecurringOrderId: undefined } : row) };
    if (!(await store.putClubState(clubId, payload, state.revision)).conflict) return;
  }
  fail();
}
