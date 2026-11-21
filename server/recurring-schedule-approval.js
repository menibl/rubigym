import { clubDate } from '../shared/membership-calendar.js';
import { providerTimestamp } from './provider-date.js';
import { recurringServicePeriod } from '../shared/recurring-service-period.js';

export function proposeRecurringSchedule({ payload, userId, seriesId, details: result, anchorCharge, serviceMonth, reason, managerId, checkedAt }) {
  const details = result?.data || result?.Data || result;
  const value = Array.isArray(details) && details.length === 1 ? details[0] : details;
  const checkouts = (payload.recurringCheckouts || []).filter(item => !item.cancelledAt && item.recurringSaleId === seriesId
    && (item.userId === userId || item.orderSnapshot?.gp?.some(line => line.memberId === userId)));
  if (checkouts.length !== 1) throw new Error('יש לבחור הוראה קיימת שכבר שויכה ואומתה למתאמן. אין לאשר שיוך חדש במסך זה.');
  const creation = providerTimestamp(value?.CreationDate), end = providerTimestamp(value?.EndDate);
  const policy = { version: 1, orderId: checkouts[0].orderId, seriesId, anchorCharge: Number(anchorCharge), serviceMonth,
    providerDay: Number(value?.RecurringDay), providerEndDate: end ? clubDate(end) : '',
    providerCreationDate: creation ? clubDate(creation) : '', reason: String(reason || '').trim(),
    approvedBy: managerId, approvedAt: new Date(checkedAt).toISOString() };
  const first = recurringServicePeriod(policy, 1);
  if (!first || !creation || !end || policy.reason.length < 5 || policy.reason.length > 500) throw new Error('יש להזין מספר חיוב 1–12, חודש שירות תקין וסיבת שינוי של 5–500 תווים.');
  const creationMonth = clubDate(creation).slice(0, 7);
  const [year, month] = creationMonth.split('-').map(Number);
  const next = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 7);
  if (first.month !== creationMonth && first.month !== next) throw new Error('חודש השירות הראשון צריך להיות חודש ההקמה או החודש שאחריו. אין להעניק שנת מנוי נוספת באמצעות שינוי תאריכים.');
  return { checkout: checkouts[0], policy: { ...policy, coverageEndsAt: first.endsAt } };
}
