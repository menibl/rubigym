import { clubDate, isCalendarMembership } from '../shared/membership-calendar.js';
import { providerTimestamp as providerTime, providerDateFormat } from './provider-date.js';

const reject = message => { throw new Error(message); };
export const recurringId = value => {
  const id = String(value || '').trim().toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id) ? id : null;
};
const phone = value => String(value || '').replace(/\D/g, '').replace(/^00972/, '0').replace(/^972/, '0');
const providerData = result => {
  if (!result || (result.error_code !== undefined && Number(result.error_code) !== 0)
    || (result.Status !== undefined && Number(result.Status) !== 0)) reject('רווחית לא החזירה תשובה תקינה. לא שונה דבר.');
  const value = result.data || result.Data || result;
  return Array.isArray(value) ? value.length === 1 ? value[0] : null : value;
};
const rejectDate = (message, code, field, value) => {
  const error = new Error(message);
  error.code = code;
  error.diagnostic = { code, field, format: providerDateFormat(value) };
  throw error;
};
const documentKey = value => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'api.rivhit.co.il' && url.pathname.startsWith('/pdf/') ? url.pathname : null;
  } catch { return null; }
};

// A manager supplies only the series UUID. Never reconstruct a payment from a
// name, price or screenshot: bind the provider phone to a server-owned checkout,
// and require complete successful history, real document references and counts.
export function prepareRecurringIdSync({ payload, userId, seriesId, details: detailsResult, history: historyResult, appUrl, now = new Date() }) {
  if (!recurringId(seriesId)) reject('יש להזין מזהה הוראת קבע תקין, כפי שמופיע בלוג iCredit.');
  const details = providerData(detailsResult), history = providerData(historyResult);
  const user = payload.users?.find(member => member.id === userId && member.role === 'TRAINEE');
  if (!user || !details || !history) reject('לא נמצאו פרטי הוראה מלאים למתאמן שנבחר.');
  let expectedIpn;
  try { expectedIpn = new URL('/api/payments/rivhit/webhook', appUrl).href; } catch { reject('כתובת המועדון אינה מוגדרת כראוי.'); }
  if (details.IpnUrl !== expectedIpn) reject('כתובת הדיווח בהוראת הקבע אינה שייכת למועדון. לא שונה דבר.');
  const boundElsewhere = payload.users.some(member => member.id !== userId && Object.values(member.recurringMemberships || {}).some(contract => contract.seriesId?.toLowerCase() === seriesId));
  if (boundElsewhere) reject('הוראת הקבע כבר משויכת למתאמן אחר. לא שונה דבר.');
  if (Object.values(user.recurringMemberships || {}).some(contract => contract.seriesId?.toLowerCase() === seriesId && contract.cancelledAt)) reject('ההוראה בוטלה באפליקציה. אין להפעיל אותה מחדש באמצעות סנכרון.');
  // A shared family email is not identity evidence. Require the beneficiary's
  // phone (or its actual family payer) AND the beneficiary's saved checkout.
  const payer = payload.users.find(member => member.id === user.familyPayerId);
  const ownerPhones = [user.phone, payer?.phone].map(phone).filter(value => /^0\d{8,9}$/.test(value));
  if (!ownerPhones.includes(phone(details.PhoneNumber))) reject('מספר הטלפון ברווחית אינו תואם למתאמן או למשלם המשפחתי. אין לשייך הוראה לפי שם או אימייל בלבד.');
  if (details.IsActive !== true || details.AutoCharge !== true || Number(details.Currency) !== 1
    || Number(details.RecurringCycle) !== 3 || Number(details.RecurringDay) !== 1 || Number(details.RecurringStep) !== 1
    || Number(details.RecurringSaleCount) !== 12 || details.ProRata !== false) reject('תנאי ההוראה אינם תואמים לסדרה פעילה של 12 חיובים חודשיים ב־1 לחודש. נדרשת בדיקת מנהל מול רווחית.');
  const creation = providerTime(details.CreationDate), ending = providerTime(details.EndDate);
  if (!creation) rejectDate('לא ניתן לקרוא את תאריך הקמת ההוראה שחזר מרווחית (CreationDate). אין פירוש הדבר שהמנוי הסתיים.', 'RIVHIT_CREATION_DATE_FORMAT', 'CreationDate', details.CreationDate);
  if (!ending) rejectDate('לא ניתן לקרוא את תאריך סיום ההוראה שחזר מרווחית (EndDate). אין פירוש הדבר שהמנוי הסתיים.', 'RIVHIT_END_DATE_FORMAT', 'EndDate', details.EndDate);
  if (creation.getTime() > now.getTime() + 60000) rejectDate('תאריך הקמת ההוראה ברווחית נמצא בעתיד. יש לבדוק את נתוני הספק; לא שונה המנוי.', 'RIVHIT_CREATION_DATE_FUTURE', 'CreationDate', details.CreationDate);
  if (ending <= creation) rejectDate('תאריך סיום ההוראה ברווחית אינו מאוחר מתאריך ההקמה. יש לבדוק את תנאי ההוראה.', 'RIVHIT_END_BEFORE_CREATION', 'EndDate', details.EndDate);
  if (ending.getTime() - creation.getTime() > 13 * 31 * 86400000) rejectDate('תקופת ההוראה שחזרה מרווחית ארוכה מהסדרה השנתית שאושרה. הסנכרון נעצר לבדיקה.', 'RIVHIT_END_DATE_RANGE', 'EndDate', details.EndDate);
  if (clubDate(ending) <= clubDate(now)) rejectDate(`לפי תאריך הסיום שחזר מרווחית, ההתקשרות הסתיימה בתאריך ${clubDate(ending)}. לא בוצע חידוש או חיוב נוסף.`, 'RIVHIT_CONTRACT_ENDED', 'EndDate', details.EndDate);
  const endsAt = clubDate(ending);
  const candidates = (payload.recurringCheckouts || []).filter(checkout => checkout.userId === userId && !checkout.cancelledAt
    && checkout.endsAt === endsAt && isCalendarMembership(checkout.membershipType)
    && (!checkout.recurringSaleId || checkout.recurringSaleId.toLowerCase() === seriesId)
    && Number.isFinite(Date.parse(checkout.dispatchedAt)) && clubDate(new Date(checkout.dispatchedAt)) === clubDate(creation));
  if (candidates.length !== 1) reject(candidates.length ? 'נמצאו כמה בקשות הקמה מתאימות. אין לשייך אוטומטית; יש לסנכרן לפי SaleId.' : 'לא נמצאה בקשת הקמה שמורה התואמת למתאמן ולתאריכי ההוראה. יש לסנכרן לפי SaleId או לפנות לתמיכה.');
  const checkout = candidates[0], snapshot = checkout.orderSnapshot;
  const amount = Number(details.Amount), count = Number(details.ChargeCount);
  if (!(amount > 0) || !Number.isFinite(amount) || !Number.isInteger(count) || count < 0 || count > 12) reject('הסכום או מונה החיובים ברווחית אינם תקינים.');
  if (snapshot && (Number(snapshot.a) !== amount || snapshot.rc !== 1 || snapshot.m !== checkout.membershipType
    || (snapshot.bu || snapshot.u) !== userId || snapshot.re !== endsAt || snapshot.o !== checkout.orderId)) reject('תנאי הוראת הקבע שונים מהבקשה המקורית שנשמרה. לא שונה דבר.');
  const records = history.RecurringSaleHistoryList;
  if (!Array.isArray(records) || records.length > 100) reject('לא התקבלה היסטוריית חיובים מלאה מרווחית.');
  const sorted = records.map(record => ({ ...record, time: providerTime(record.Timestamp) }))
    .sort((a, b) => (a.time?.getTime() || 0) - (b.time?.getTime() || 0));
  const invalidTime = sorted.find(record => !record.time);
  if (invalidTime) rejectDate('לא ניתן לקרוא תאריך חיוב בהיסטוריית רווחית (Timestamp). לא נוצר רישום תשלום.', 'RIVHIT_HISTORY_DATE_FORMAT', 'Timestamp', invalidTime.Timestamp);
  if (sorted.some(record => record.time.getTime() > now.getTime() + 60000 || record.time < creation)) rejectDate('תאריך חיוב בהיסטוריית רווחית נמצא בעתיד או לפני הקמת ההוראה. נדרשת בדיקה.', 'RIVHIT_HISTORY_DATE_RANGE', 'Timestamp', sorted[0]?.Timestamp);
  const successful = sorted.filter(record => Number(record.StatusCode) === 3 && Number(record.RivhitCode) === 0
    && documentKey(record.DocumentLink));
  // The documented history does not expose SaleId or the provider charge number.
  // Only a complete, all-success history can be mapped to consecutive counters;
  // never guess counters through failed attempts or partial provider history.
  if (successful.length !== count || sorted.length !== count || successful.some(record => Number(record.Amount) !== amount)) reject('היסטוריית החיובים כוללת כשל, נתון חסר או סכום שונה. נדרשת בדיקה מול רווחית; לא נוצר תשלום באפליקציה.');
  const docs = new Set(successful.map(record => documentKey(record.DocumentLink)));
  if (docs.size !== count) reject('היסטוריית רווחית מכילה מסמכים כפולים. יש לבדוק מול רווחית.');
  const order = snapshot || { o: checkout.orderId, u: payer?.id || userId, ...(payer ? { bu: userId } : {}),
    m: checkout.membershipType, d: 'PRIMARY', a: amount, rc: 1, rr: true, rm: 12,
    bp: 'MONTHLY_ANNUAL_COMMITMENT', tm: 12, re: endsAt, t: creation.getTime() };
  const payments = successful.map((record, index) => ({ transactionId: `series-${seriesId}-charge-${index + 1}`,
    recurringSaleId: seriesId, recurringChargeNumber: index + 1, providerChargeDate: clubDate(record.time),
    historyTimestamp: record.time.toISOString(), providerDocumentKey: documentKey(record.DocumentLink),
    last4Digits: (String(record.TruncCardNum || '').match(/(\d{4})\D*$/) || [])[1], providerHistoryVerified: true }));
  const preview = { seriesId, userName: user.name, membershipType: order.m,
    planLabel: payload.settings?.membershipPlans?.find(plan => plan.id === order.m)?.label || order.m,
    amount, successfulCharges: count, endsAt, discountRecorded: Boolean(snapshot),
    discountCode: snapshot?.c || null, nextChargeDate: providerTime(details.ChargeDate) ? clubDate(providerTime(details.ChargeDate)) : null };
  return { order, payments, preview, discountUnknown: !snapshot };
}
