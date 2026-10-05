import React, { useEffect, useState } from 'react';
import { MembershipPlanConfig } from '../types';
import { recurringSummary } from '../../shared/recurring-billing.js';

export function RecurringPlanNotice({ plan }: { plan?: MembershipPlanConfig }) {
  const [accepted, setAccepted] = useState(false);
  useEffect(() => setAccepted(false), [plan?.id, plan?.price, plan?.recurringTermMonths, plan?.renewalMode]);
  let summary;
  try { summary = recurringSummary(plan); } catch { return <p role="alert">הגדרות הוראת הקבע אינן תקינות. יש לפנות למנהל.</p>; }
  if (!summary) return null;
  return <section aria-label="סיכום הוראת קבע" className="rounded-xl border border-amber-400 bg-slate-900 p-4 text-white">
    <h3 className="text-lg font-bold text-amber-200">חיוב חודשי מתחדש בהוראת קבע</h3>
    <p className="mt-2 text-sm leading-7">{summary.notice}</p>
    <label className="mt-3 flex min-h-11 items-start gap-3 text-sm"><input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)} className="mt-1 h-5 w-5 shrink-0" />קראתי את סיכום החיוב החודשי ומדיניות החידוש. זהו מסך הכנה בלבד — האישור כאן אינו מפעיל הוראת קבע.</label>
    <p role="status" className="mt-3 text-sm font-bold text-amber-200">השירות בהכנה. לא ניתן לעבור לתשלום במסלול הוראת קבע עד השלמת אישור רווחית והחיבור.</p>
  </section>;
}
