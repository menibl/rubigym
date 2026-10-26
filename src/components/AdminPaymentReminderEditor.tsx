import React, { useState } from 'react';
import type { User } from '../types';
import { clubDate } from '../../shared/membership-calendar.js';
import { paymentReminderWindow, shiftReminderDate, validReminderDate } from '../../shared/payment-reminder-policy.js';

export function updatePaymentReminderSettings(user: User, exempt: boolean, until: string, today = clubDate()): User {
  if (until && (!validReminderDate(until) || until < today)) throw new Error('יש לבחור תאריך סיום מהיום והלאה.');
  if (until && !validReminderDate(user.membershipExpiry)) throw new Error('יש להגדיר קודם תוקף מנוי בפעולות המסלול.');
  return { ...user, paymentReminderExempt: exempt, paymentReminderUntil: until,
    paymentReminderExpiry: until ? user.membershipExpiry : '' };
}

export function AdminPaymentReminderEditor({ user, onSave }: { user: User; onSave: (user: User) => void }) {
  const today = clubDate();
  const currentUntil = user.paymentReminderExpiry === user.membershipExpiry ? user.paymentReminderUntil || '' : '';
  const [until, setUntil] = useState(currentUntil);
  const [exempt, setExempt] = useState(Boolean(user.paymentReminderExempt));
  const [error, setError] = useState('');
  const window = paymentReminderWindow(user, today);
  const changed = until !== currentUntil || exempt !== Boolean(user.paymentReminderExempt);
  return <details className="w-full rounded-xl border border-slate-600 p-3 text-right text-slate-100">
    <summary className="min-h-11 cursor-pointer font-bold">תזכורות לחידוש מנוי</summary>
    <p className="my-2 text-xs text-slate-300">הודעה יומית באפליקציה ו־SMS כל 3 ימים, למשך 14 ימים מפקיעת התוקף. החל מ־10:00, שעון ישראל. חידוש תוקף או הקפאה עוצרים את התזכורות. במשפחה ההודעה נשלחת למשלם.</p>
    <p className="my-2 text-sm">{user.paymentReminderExempt ? 'לא משלם — תזכורות כבויות' : user.isMembershipFrozen && (!user.membershipFrozenUntil || user.membershipFrozenUntil >= today) ? 'בהקפאה — תזכורות מושהות' : window ? `תקופת התזכורות: ${window.start} עד ${window.until} (כולל)` : 'לא הוגדר תאריך תוקף — לא יישלחו תזכורות'}</p>
    <form className="space-y-2" onSubmit={event => {
      event.preventDefault();
      try { onSave(updatePaymentReminderSettings(user, exempt, until, today)); setError(''); }
      catch (err) { setError(err instanceof Error ? err.message : 'לא ניתן לשמור תזכורות.'); }
    }}>
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={exempt} onChange={event => setExempt(event.target.checked)} />לא משלם — הפסקת תזכורות תשלום</label>
      <p className="text-xs text-slate-300">הסימון אינו מעניק מנוי פעיל, אינו מוחק חוב ואינו מבטל הוראת קבע ברווחית.</p>
      <label className="block text-sm">הארכת תזכורות עד תאריך (כולל)
        <input type="date" aria-label={`תזכורות תשלום עד תאריך עבור ${user.name}`} min={today} disabled={exempt} value={until} onChange={event => setUntil(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-500 bg-slate-950 p-2 text-slate-100" />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={exempt} className="min-h-11 rounded border border-slate-500 px-2 text-sm" onClick={() => setUntil(shiftReminderDate(today, 7))}>עוד שבוע</button>
        <button type="button" disabled={exempt} className="min-h-11 rounded border border-slate-500 px-2 text-sm" onClick={() => setUntil(shiftReminderDate(today, 30))}>עוד 30 יום</button>
        <button type="button" className="min-h-11 rounded border border-slate-500 px-2 text-sm" onClick={() => setUntil('')}>חזרה ל־14 ימים</button>
      </div>
      <p className="text-xs text-slate-300">הארכה תקפה למחזור הנוכחי בלבד. לחידוש ההודעות יש להסיר ״לא משלם״ ולשמור תאריך עתידי. לא נשלחות שוב הודעות על ימים שהוחמצו.</p>
      {error && <p role="alert" className="text-sm text-rose-200">{error}</p>}
      <button type="submit" disabled={!changed} className="min-h-11 w-full rounded-lg bg-amber-400 p-2 font-bold text-black disabled:opacity-50">שמור הגדרות תזכורות</button>
    </form>
  </details>;
}
