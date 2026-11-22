import { invoiceCustomerName } from './person-name.js';

const uuid = value => /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(String(value || ''));
const fail = message => { throw new Error(message); };

export function hydrateFamilyTransferAudit(payload, records) {
  if (!records.length) return payload;
  const audits = new Map((payload.familyPayerTransfers || []).map(record => [record.id, record]));
  for (const record of records) audits.set(record.id, record);
  const ordered = [...audits.values()].sort((a, b) => a.approvedAt.localeCompare(b.approvedAt) || a.id.localeCompare(b.id));
  const assignments = new Map((payload.recurringInvoicePayers || []).map(item => [item.seriesId, item]));
  for (const record of ordered) for (const item of record.instructions || []) assignments.set(item.seriesId, {
    ...item, familyId: record.familyId, invoicePayerId: record.toId, transferId: record.id, approvedPreviousName: record.providerNames[item.seriesId]
  });
  return { ...payload, familyPayerTransfers: ordered, recurringInvoicePayers: [...assignments.values()] };
}

export function prepareFamilyPayerTransfer(payload, fromId, toId, today) {
  const users = payload.users || [], from = users.find(user => user.id === fromId), to = users.find(user => user.id === toId);
  if (!from?.familyId || !from.isFamilyPayer || from.role !== 'TRAINEE' || fromId === toId) fail('יש לבחור ראש משפחה קיים ובן משפחה אחר.');
  const members = users.filter(user => user.familyId === from.familyId);
  if (!to || to.familyId !== from.familyId || to.role !== 'TRAINEE' || to.isFamilyPayer || to.registrationIncomplete) fail('המשלם החדש חייב להיות בן משפחה רשום באותה משפחה.');
  if (members.length < 2 || members.length > 6 || members.some(user => user.role !== 'TRAINEE' || (user.isFamilyPayer && user.id !== fromId))) fail('שיוך המשפחה אינו תקין. נדרשת בדיקת מנהל.');
  const name = invoiceCustomerName(users, toId);
  if (!name || name.firstName.length > 20 || name.lastName.length > 30) fail('יש להשלים שם פרטי ושם משפחה תקינים למשלם החדש.');
  const memberIds = members.map(user => user.id).sort(), series = new Map();
  for (const user of members) for (const contract of Object.values(user.recurringMemberships || {})) {
    if (contract.cancelledAt || contract.endsAt <= today) continue;
    if (!uuid(contract.seriesId)) fail('מזהה הוראת קבע אינו תקין. יש לסנכרן את ההוראה לפני העברה.');
    series.set(contract.seriesId.toLowerCase(), null);
  }
  const involved = item => memberIds.includes(item.userId) || memberIds.includes(item.orderSnapshot?.u)
    || memberIds.includes(item.orderSnapshot?.bu) || item.orderSnapshot?.gp?.some(line => memberIds.includes(line.memberId));
  for (const item of payload.recurringCheckouts || []) {
    if (item.cancelledAt || item.endsAt <= today || !involved(item)) continue;
    if (!uuid(item.recurringSaleId)) fail('קיימת בקשת הוראת קבע פתוחה שטרם אומתה. יש להשלים סנכרון לפני החלפת משלם.');
    series.set(item.recurringSaleId.toLowerCase(), null);
  }
  const cancelled = new Set((payload.payments || []).filter(payment => payment.recurringCancelledAt).map(payment => String(payment.providerRecurringSaleId).toLowerCase()));
  for (const payment of payload.payments || []) {
    if (!payment.providerRecurringSaleId || (!memberIds.includes(payment.traineeId) && !payment.familyMemberPlans?.some(line => memberIds.includes(line.memberId)))) continue;
    const id = String(payment.providerRecurringSaleId).toLowerCase();
    if (series.has(id) || cancelled.has(id)) continue;
    const known = [
      ...(payload.recurringCheckouts || []).filter(item => String(item.recurringSaleId).toLowerCase() === id),
      ...members.flatMap(user => Object.values(user.recurringMemberships || {})).filter(contract => String(contract.seriesId).toLowerCase() === id)
    ];
    if (known.length && known.every(item => item.cancelledAt || item.endsAt <= today)) continue;
    fail('קיים תיעוד הוראת קבע שאינה משויכת להוראה מאומתת. יש לסנכרן אותה לפני החלפת משלם.');
  }
  for (const id of series.keys()) {
    const checkouts = (payload.recurringCheckouts || []).filter(item => String(item.recurringSaleId).toLowerCase() === id && !item.cancelledAt);
    const owners = [...new Set(checkouts.map(item => item.orderSnapshot?.u).filter(Boolean))];
    if (owners.length !== 1 || !memberIds.includes(owners[0]) || checkouts.some(item => !item.orderSnapshot || item.orderSnapshot.o !== item.orderId
      || (item.orderSnapshot.gp || []).some(line => !memberIds.includes(line.memberId))
      || !memberIds.includes(item.orderSnapshot.bu || item.orderSnapshot.u))) fail('לא ניתן לאמת בעלות על הוראה משפחתית. לא תבוצע העברה.');
    const contracts = users.flatMap(user => Object.values(user.recurringMemberships || {}).filter(contract => String(contract.seriesId).toLowerCase() === id && !contract.cancelledAt).map(contract => ({ user, contract })));
    if (!contracts.length || contracts.some(({ user, contract }) => !memberIds.includes(user.id) || !checkouts.some(item => item.orderId === contract.orderId))) fail('הוראה משויכת גם לחשבון מחוץ למשפחה או חסר תיעוד. לא תבוצע העברה.');
    series.set(id, { seriesId: id, sourcePayerId: owners[0], orderIds: checkouts.map(item => item.orderId).sort() });
  }
  const instructions = [...series.values()].sort((a, b) => a.seriesId.localeCompare(b.seriesId));
  return { familyId: from.familyId, fromId, toId, fromName: from.name, toName: `${name.firstName} ${name.lastName}`, memberIds, instructions,
    members: members.map(user => ({ id: user.id, name: user.name })),
    fingerprintInput: JSON.stringify({ familyId: from.familyId, fromId, toId, instructions,
      members: members.map(user => ({ id: user.id, name: user.name, phone: user.phone, username: user.username,
        familyPayerId: user.familyPayerId, isFamilyPayer: user.isFamilyPayer })).sort((a, b) => a.id.localeCompare(b.id)) }) };
}

export function applyFamilyPayerTransfer(payload, plan, record) {
  const old = payload.users.find(user => user.id === plan.fromId);
  const users = payload.users.map(user => {
    if (!plan.memberIds.includes(user.id)) return user;
    if (user.id === plan.toId) return { ...user, isFamilyPayer: true, familyPayerId: undefined,
      familyMembersCount: old.familyMembersCount ?? plan.memberIds.length, familyBillingMode: old.familyBillingMode, familyTrackName: old.familyTrackName, familyCombinedAmount: old.familyCombinedAmount,
      familyMemberPlans: old.familyMemberPlans?.map(line => ({ ...line, memberName: payload.users.find(member => member.id === line.memberId)?.name || line.memberName })) };
    return { ...user, isFamilyPayer: false, familyPayerId: plan.toId, familyMembersCount: undefined,
      familyMemberPlans: undefined, familyBillingMode: undefined, familyTrackName: undefined, familyCombinedAmount: undefined };
  });
  const pending = { status: 'PENDING', code: 'NAME_SYNC_PAYER_TRANSFER', checkedAt: record.approvedAt, nextAttemptAt: record.approvedAt };
  return { ...payload, users: users.map(user => ({ ...user, recurringMemberships: user.recurringMemberships
    ? Object.fromEntries(Object.entries(user.recurringMemberships).map(([type, contract]) => [type, plan.instructions.some(item => item.seriesId === String(contract.seriesId).toLowerCase()) ? { ...contract, customerNameSync: pending } : contract])) : user.recurringMemberships })),
    recurringCheckouts: (payload.recurringCheckouts || []).map(item => plan.instructions.some(line => line.seriesId === String(item.recurringSaleId).toLowerCase()) ? { ...item, customerNameSync: pending } : item),
    recurringInvoicePayers: [...(payload.recurringInvoicePayers || []).filter(item => !plan.instructions.some(line => line.seriesId === item.seriesId)),
      ...plan.instructions.map(item => ({ ...item, familyId: plan.familyId, invoicePayerId: plan.toId, transferId: record.id,
        approvedPreviousName: record.providerNames[item.seriesId] }))],
    familyPayerTransfers: [...(payload.familyPayerTransfers || []), record] };
}

// An old open manager tab must not restore the old head during an unrelated
// profile/calendar save. Ordinary member moves to another family stay allowed.
export function preserveTransferredFamilyHeads(current, incoming) {
  const families = [...new Set((current.familyPayerTransfers || []).map(record => record.familyId))];
  const heads = new Map(families.map(id => [id, current.users?.find(user => user.familyId === id && user.isFamilyPayer)]).filter(([, user]) => user));
  return { ...incoming, users: (incoming.users || []).map(user => {
    const original = current.users?.find(member => member.id === user.id);
    const ownHead = heads.get(original?.familyId);
    if (ownHead?.id === user.id) return { ...user, familyId: original.familyId, familyName: original.familyName, isFamilyPayer: true,
      familyPayerId: undefined, ...(!user.isFamilyPayer ? { familyMemberPlans: original.familyMemberPlans, familyMembersCount: original.familyMembersCount,
        familyBillingMode: original.familyBillingMode, familyTrackName: original.familyTrackName, familyCombinedAmount: original.familyCombinedAmount } : {}) };
    const head = heads.get(user.familyId);
    return head ? { ...user, isFamilyPayer: false, familyPayerId: head.id, familyMembersCount: undefined, familyMemberPlans: undefined,
      familyBillingMode: undefined, familyTrackName: undefined, familyCombinedAmount: undefined } : user;
  }) };
}
