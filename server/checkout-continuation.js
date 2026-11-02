const fail = code => { throw Object.assign(new Error(code), { code }); };
const uuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value));
const phone = value => String(value || '').replace(/\D/g, '').replace(/^00972/, '0').replace(/^972/, '0');

export function continuationSale(result, signedOrder, expectedAmount) {
  if (!result || typeof result.Status === 'boolean' || result.Status === null || result.Status === '' || Number(result.Status) !== 0
    || (result.error_code !== undefined && Number(result.error_code) !== 0)) fail('CONTINUATION_PROVIDER_STATUS');
  const raw = result.data ?? result.Data ?? result;
  if (Array.isArray(raw) && raw.length > 1) fail('CONTINUATION_MULTIPLE_SALES');
  const sale = (Array.isArray(raw) ? raw[0] : raw) || {};
  if (typeof sale !== 'object' || Array.isArray(sale)) fail('CONTINUATION_PROVIDER_SHAPE');
  const amount = ['TransactionAmount', 'TotalAmount', 'Amount'].map(key => sale[key]).find(value => value !== undefined && value !== null && value !== '');
  const custom = sale.Custom1;
  if (custom !== undefined && custom !== null && custom !== '' && String(custom) !== signedOrder) fail('CONTINUATION_ORDER_MISMATCH');
  if (amount !== undefined && (!Number.isFinite(Number(amount)) || (Number(amount) !== 0 && Number(amount) !== expectedAmount))) fail('CONTINUATION_AMOUNT_MISMATCH');
  return { sale, incomplete: !sale.SaleId || !custom || amount === undefined || Number(amount) === 0 };
}

// Missing SaleDetails is not absence. Only a server-held original page plus a
// complete negative recurring search may be reopened; never call GetUrl here.
export async function checkNoActiveContinuation({ payload, order, groupToken, post }) {
  if (!groupToken) fail('CONTINUATION_MERCHANT_MISSING');
  const ids = [...new Set([order.u, order.bu, ...(order.gp || []).map(line => line.memberId)].filter(Boolean))];
  const people = ids.map(id => payload.users?.find(user => user.id === id));
  if (people.some(person => !person)) fail('CONTINUATION_OWNER_MISSING');
  const phones = [...new Set(people.map(person => phone(person.phone)).filter(value => /^0\d{8,9}$/.test(value)))];
  if (!phones.length || phones.length > 6) fail('CONTINUATION_PHONE_MISSING');
  for (const number of phones) {
    let result;
    try { result = await post('/RecurringSaleList', { GroupPrivateToken: groupToken, PhoneNumber: number }); }
    catch { fail('CONTINUATION_LIST_UNAVAILABLE'); }
    if (!result || (result.Status !== undefined && Number(result.Status) !== 0) || (result.error_code !== undefined && Number(result.error_code) !== 0)) fail('CONTINUATION_LIST_UNAVAILABLE');
    const raw = (result.data || result.Data || result).RecurringSales;
    const list = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? [raw] : null;
    if (!list || list.length > 100 || list.some(row => !uuid(row?.RecurringSaleId) || typeof row.IsActive !== 'boolean')) fail('CONTINUATION_LIST_INVALID');
    if (list.some(row => row.IsActive)) fail('CONTINUATION_ACTIVE_SERIES');
  }
}
