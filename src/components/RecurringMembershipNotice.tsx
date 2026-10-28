import React from 'react';
import { clubDate } from '../../shared/membership-calendar.js';
import { type User, type MembershipPlanConfig, MembershipType, MEMBERSHIP_TYPE_LABELS } from '../types';

export function RecurringMembershipNotice({ user, plans = [] }: { user: User; plans?: MembershipPlanConfig[] }) {
  return <span className="block space-y-2 text-right text-xs leading-5" aria-label="מצב הוראות הקבע">
    {Object.entries(user.recurringMemberships || {}).map(([type, contract]) => <span key={type} className={`block rounded-lg border p-2 ${contract.status === 'PAYMENT_FAILED' ? 'border-rose-500 bg-rose-950 text-rose-100' : 'border-amber-600 bg-slate-950 text-amber-100'}`}>
      <strong className="block">{plans.find(plan => plan.id === type)?.label || MEMBERSHIP_TYPE_LABELS[type as MembershipType]?.label || type}</strong>
      <span className="block">{contract.status === 'PAYMENT_FAILED' ? 'המסלול הושהה — כשל חיוב מאומת ברווחית. יש לפנות למנהל להסדרת התשלום.' : contract.endsAt <= clubDate() ? 'תקופת הוראת הקבע הסתיימה — יש להסדיר חידוש באישור המשתמש.' : contract.status === 'PENDING_FIRST_CHARGE' ? 'המנוי פעיל — ממתין לאישור החיוב הראשון. טרם נרשם תשלום שהושלם.' : 'הוראת קבע פעילה — חיוב אומת ברווחית.'}</span>
      <span className="block">סכום קבוע לכל חיוב: ₪{contract.amount} · 12 חיובים · ללא חידוש אוטומטי לשנה נוספת</span>
      {contract.discountCode && <span className="block">קוד הנחה: {contract.discountCode} — ההנחה כלולה בסכום לכל תקופת הסדרה.</span>}
      <span className="block">תוקף ההתקשרות: <bdi>{contract.endsAt}</bdi></span>
      {contract.paidUntil && <span className="block">תשלום מאומת לתקופה עד <bdi>{contract.paidUntil}</bdi> (לא כולל)</span>}
    </span>)}
  </span>;
}
