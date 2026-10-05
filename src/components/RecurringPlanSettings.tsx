import React from 'react';
import { MembershipPlanConfig } from '../types';

export function RecurringPlanSettings({ plan, onChange }: { plan: Partial<MembershipPlanConfig>; onChange: (patch: Partial<MembershipPlanConfig>) => void }) {
  return <fieldset className="col-span-full rounded-xl border border-slate-600 bg-slate-900 p-3 text-white">
    <legend className="px-1 text-sm font-bold">אופן התשלום — נפרד מתקופת המסלול</legend>
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="text-sm">אופן התשלום<select value={plan.paymentMode || 'ONE_TIME'} onChange={event => onChange({ paymentMode: event.target.value as MembershipPlanConfig['paymentMode'] })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-600 bg-slate-800 p-2 text-white"><option value="ONE_TIME">תשלום חד־פעמי</option><option value="RECURRING">הוראת קבע חודשית — בהכנה</option></select></label>
      {plan.paymentMode === 'RECURRING' && <>
        <label className="text-sm">תקופת המסלול בחודשים<input type="number" min={1} max={36} value={plan.recurringTermMonths ?? 12} onChange={event => onChange({ recurringTermMonths: Math.max(1, Math.min(36, Math.trunc(Number(event.target.value) || 12))) })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-600 bg-slate-800 p-2 text-white" /></label>
        <label className="text-sm">בסיום התקופה<select value={plan.renewalMode || 'AUTO'} onChange={event => onChange({ renewalMode: event.target.value as MembershipPlanConfig['renewalMode'] })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-600 bg-slate-800 p-2 text-white"><option value="AUTO">חידוש אוטומטי עם הודעה מראש</option><option value="CONFIRM">חידוש רק לאחר אישור המתאמן</option></select></label>
      </>}
    </div>
    {plan.paymentMode === 'RECURRING' && <p className="mt-2 text-sm text-amber-200">המחיר הוא לחודש. החיוב המתוכנן ב־1 בחודש. התשלום במסלול זה חסום עד אישור רווחית והשלמת החיבור; אפשר להשאירו מוסתר עד אז. שינוי ההגדרה אינו מעביר מנויים קיימים להוראת קבע.</p>}
  </fieldset>;
}
