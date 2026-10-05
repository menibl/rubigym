import React, { useEffect, useState } from 'react';
import { isPagesDemoMode } from '../data/appMode';

export function RecurringBillingStatus() {
  const [data, setData] = useState<{ subscriptions: Array<{ id: string; planName: string; userId: string; monthlyAmount: number; nextChargeAt?: string; endsAt: string; status: string }>; notices: Array<{ id: string; userId: string; date: string; smsStatus: string }> } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (isPagesDemoMode()) { setData({ subscriptions: [], notices: [] }); return; }
    const controller = new AbortController();
    const base = (import.meta.env.VITE_PAYMENT_API_URL || window.location.origin).replace(/\/$/, '');
    void fetch(`${base}/api/payments/rivhit/recurring/status`, { credentials: 'include', signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error('לא ניתן לטעון את מצב הוראות הקבע מהשרת.'); return response.json(); })
      .then(setData).catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, []);
  return <section className="rounded-2xl border border-amber-400/50 bg-slate-900 p-4 text-white" aria-label="תשתית הוראות קבע">
    <h3 className="font-bold text-amber-200">הוראות קבע — תשתית בהכנה</h3>
    <p className="mt-2 text-sm">יצירת הוראות קבע חסומה עד אישור רווחית והשלמת החיבור. מנוי חודשי ששולם ידנית אינו הוראת קבע.</p>
    {error && <p role="alert" className="mt-2 text-rose-200">{error}</p>}
    {!data && !error && <p role="status" className="mt-2">טוען מצב מהשרת…</p>}
    {data && <>
      <p className="mt-2 text-sm">מנויים חוזרים מתועדים: {data.subscriptions.length}. התראות SMS הדורשות בדיקה: {data.notices.filter(notice => ['REVIEW_REQUIRED', 'MISSING_PHONE', 'ATTEMPTING'].includes(notice.smsStatus)).length}.</p>
      {data.subscriptions.map(subscription => <article key={subscription.id} className="mt-3 rounded-xl border border-slate-600 p-3"><strong>{subscription.planName}</strong><p>מצב: {subscription.status} · ₪{subscription.monthlyAmount} לחודש</p><p>חיוב הבא: {subscription.nextChargeAt || 'טרם נקבע'} · סיום תקופה: {subscription.endsAt}</p></article>)}
      {data.notices.slice(-20).reverse().map(notice => <p key={notice.id} className="mt-2 text-sm">{notice.date} · מתאמן {notice.userId} · {({ PROVIDER_ACCEPTED: 'הספק קיבל את ה־SMS; מסירה למכשיר לא אומתה', REVIEW_REQUIRED: 'נדרשת בדיקת שליחה', MISSING_PHONE: 'חסר טלפון', ATTEMPTING: 'ניסיון שליחה — יש לבדוק אם לא הושלם' } as Record<string, string>)[notice.smsStatus] || notice.smsStatus}</p>)}
    </>}
  </section>;
}
