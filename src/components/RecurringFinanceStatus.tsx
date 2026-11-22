import React from 'react';
import { clubDate } from '../../shared/membership-calendar.js';
import { type User, type MembershipPlanConfig, MembershipType, MEMBERSHIP_TYPE_LABELS } from '../types';

export function RecurringFinanceStatus({ users, plans = [] }: { users: User[]; plans?: MembershipPlanConfig[] }) {
  const rows = users.flatMap(user => Object.entries(user.recurringMemberships || {})
    .filter(([, contract]) => !contract.cancelledAt)
    .map(([type, contract]) => ({ user, type, contract })));
  if (!rows.length) return null;
  return <details className="mb-6 space-y-2 rounded-xl border border-slate-600 p-3" aria-label="סטטוס אישור תשלומי הוראות קבע">
    <summary className="cursor-pointer text-sm font-bold">הוראות קבע — אישור תשלום · {new Set(rows.map(row => row.contract.seriesId)).size} הוראות</summary>
    <h3 className="text-sm font-bold">הוראות קבע — אישור תשלום</h3>
    <p className="text-xs">הוראה בהמתנה אינה קבלה על תשלום ואינה נכללת בסכומים ששולמו. רק דחייה מאומתת משהה את המסלול הרלוונטי.</p>
    <div className="overflow-x-auto"><table className="w-full text-right text-xs">
      <thead><tr><th className="p-2">מתאמן</th><th className="p-2">מסלול</th><th className="p-2">סכום לחיוב</th><th className="p-2">סטטוס</th><th className="p-2">תוקף ההתקשרות</th><th className="p-2">שם בחשבוניות הוראת הקבע</th></tr></thead>
      <tbody>{rows.map(({ user, type, contract }) => <tr key={`${user.id}-${type}`} className="admin-readable-row border-b border-slate-600">
        <td className="p-2">{user.name}</td>
        <td className="p-2">{plans.find(plan => plan.id === type)?.label || MEMBERSHIP_TYPE_LABELS[type as MembershipType]?.label || type}</td>
        <td className="p-2">₪{contract.amount}</td>
        <td className="p-2">{contract.status === 'PAYMENT_FAILED' ? 'תשלום נדחה — המסלול הושהה' : contract.endsAt <= clubDate() ? 'תקופת ההתקשרות הסתיימה' : contract.status === 'PENDING_FIRST_CHARGE' || !contract.paidUntil || contract.paidUntil <= clubDate() ? 'ממתין לאישור רווחית — המנוי פעיל' : 'אושר ברווחית'}</td>
        <td className="p-2"><bdi>{contract.endsAt}</bdi></td>
        <td className="p-2">{contract.customerNameSync?.status === 'SYNCED'
          ? `שם המשלם אומת ברווחית: ${contract.customerNameSync.name}`
          : contract.customerNameSync?.status === 'REVIEW_REQUIRED' ? 'נדרשת בדיקת מנהל — השם לא סונכרן'
            : contract.customerNameSync?.status === 'RETRY' ? 'אימות השם ממתין לניסיון חוזר — אין שינוי בחיוב' : 'ממתין לסנכרון שם המשלם'}
          {contract.customerNameSync?.code && <small className="block"><bdi>{contract.customerNameSync.code}</bdi></small>}
        </td>
      </tr>)}</tbody>
    </table></div>
  </details>;
}
