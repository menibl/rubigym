import React, { useEffect, useRef, useState } from 'react';
import { isPagesDemoMode } from '../data/appMode';
import { onPaymentPageReturn } from '../data/paymentPageReturn';
import { continueFamilySplitPayment, listRecoverableCheckouts, checkSavedCheckout, restartUndispatchedCheckout, resumeSavedCheckout, type RecoverableCheckout, type CheckoutPreflight } from '../data/rivhitPayments';
import { checkCheckoutReturns } from '../data/checkoutReturnChecks';

export function PendingCheckoutRecovery({ userId }: { userId: string }) {
  const [items, setItems] = useState<RecoverableCheckout[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const actionController = useRef<AbortController | null>(null);
  const autoController = useRef<AbortController | null>(null);
  const lastReturnCheck = useRef(0);
  const [checks, setChecks] = useState<Record<string, { phase: string; message?: string }>>({});
  useEffect(() => onPaymentPageReturn(() => { actionController.current?.abort(); setBusy(false); setMessage(''); setRefresh(value => value + 1); }), []);
  useEffect(() => () => actionController.current?.abort(), [userId]);
  useEffect(() => {
    const visible = () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastReturnCheck.current < 20_000 || actionController.current && !actionController.current.signal.aborted) return;
      setRefresh(value => value + 1);
    };
    document.addEventListener('visibilitychange', visible);
    return () => document.removeEventListener('visibilitychange', visible);
  }, [userId]);
  useEffect(() => {
    if (isPagesDemoMode()) return;
    const controller = new AbortController();
    autoController.current = controller;
    lastReturnCheck.current = Date.now();
    setItems([]);
    setChecks({});
    listRecoverableCheckouts(controller.signal).then(async result => {
      if (controller.signal.aborted) return;
      setItems(result);
      setChecks(Object.fromEntries(result.map((item, index) => [item.id, index < 20 ? { phase: 'CHECKING' }
        : { phase: 'SAVED', message: 'הבקשה נשמרה. אפשר ללחוץ להמשך ובדיקה של הדף המקורי.' }])));
      await checkCheckoutReturns(result, controller.signal, checkSavedCheckout, (item, value, error) => {
        const checked = value as CheckoutPreflight | undefined;
        setChecks(previous => ({ ...previous, [item.id]: error ? { phase: 'REVIEW_REQUIRED', message: (error as Error).message } : checked! }));
      });
    })
      .catch(() => { if (!controller.signal.aborted) setMessage('בדיקת בקשות קודמות אינה זמינה כרגע. אם יצאת מדף תשלום, נסה שוב את בדיקת הבקשה לפני פתיחת תשלום נוסף.'); });
    return () => controller.abort();
  }, [userId, refresh]);
  if (isPagesDemoMode() || (!items.length && !message)) return null;
  const act = async (item: RecoverableCheckout, restart = false) => {
    if (busy) return;
    if (restart && !window.confirm('הפעולה תשחרר רק בקשה שהשרת אימת שלא נשלחה כלל לרווחית. לאחר מכן אפשר לבחור מסלול מחדש. להמשיך?')) return;
    autoController.current?.abort();
    const controller = new AbortController();
    actionController.current = controller;
    setBusy(true); setMessage('בודקים את הבקשה. אין לפתוח תשלום נוסף בזמן הבדיקה.');
    try {
      if (restart) setMessage(await restartUndispatchedCheckout(item.id));
      else if (item.kind === 'FAMILY') {
        await continueFamilySplitPayment(item.id, userId, undefined, { signal: controller.signal });
        if (!controller.signal.aborted) setMessage('הבחירה נשמרה. אפשר להמשיך את התשלום מאוחר יותר.');
      } else {
        await resumeSavedCheckout(item.id, userId, { signal: controller.signal,
          onRetry: attempt => setMessage(`רווחית עדיין לא זמינה. בדיקה חוזרת ${attempt}/3 — הבקשה נשמרה ולא נפתח חיוב נוסף.`) });
        if (!controller.signal.aborted) setMessage('הבקשה נשמרה להמשך. לא נפתח תשלום נוסף.');
      }
    } catch (error) {
      if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : 'לא ניתן לבדוק כרגע. הבקשה נשמרה; אין לפתוח חיוב נוסף.');
    } finally {
      if (!controller.signal.aborted) { actionController.current = null; setBusy(false); setRefresh(value => value + 1); }
    }
  };
  return <section className="space-y-3 rounded-2xl border border-amber-400/50 bg-slate-950 p-4 text-slate-100" dir="rtl" aria-label="המשך תשלום שלא הושלם">
    <h3 className="text-lg font-black text-amber-200">המשך תשלום שלא הושלם</h3>
    <p className="text-sm leading-6">יצאת מדף התשלום? אפשר להמשיך את הבקשה שנשמרה בחשבון, גם ממכשיר אחר. פתיחת הדף אינה אישור תשלום. לא ניצור הוראת קבע נוספת במקום בקשה שעדיין נבדקת.</p>
    <p className="text-sm text-slate-300">בחזרה למסך התשלום נבדוק אוטומטית מול רווחית. אין צורך בסנכרון ידני של המאמן. המעבר לדף הסליקה יתבצע רק בלחיצה שלך.</p>
    {items.map(item => <div key={`${item.kind}-${item.id}`} className="space-y-2 rounded-xl border border-slate-600 p-3">
      <strong className="block">{item.label}</strong>
      {item.amount !== undefined && <p>סכום הבקשה המקורית: ₪{item.amount} לחודש</p>}
      <p role="status" className="text-sm text-amber-100">{checks[item.id]?.message || ({ CHECKING: 'בודקים אוטומטית את הבקשה מול רווחית…', READY: 'אפשר להמשיך בדף המקורי. טרם אושר תשלום.', COMPLETED: 'הבקשה כבר אושרה וסונכרנה. לא נדרש תשלום נוסף לבקשה זו.', NOT_SENT: 'הבחירה נשמרה; טרם נשלחה בקשת תשלום.', SAVED: 'דף התשלום הקיים נשמר. אין בכך אישור שהתשלום הושלם.', REVIEW_REQUIRED: 'הבדיקה טרם הושלמה. הבקשה נשמרה; אפשר לנסות שוב ללא פתיחת חיוב נוסף.' }[checks[item.id]?.phase || 'CHECKING'])}</p>
      {checks[item.id]?.phase !== 'COMPLETED' && <button type="button" disabled={busy} className="min-h-11 rounded-xl bg-amber-300 px-4 py-2 font-bold text-slate-950 disabled:opacity-50" onClick={() => void act(item)}>{busy ? 'בודקים…' : checks[item.id]?.phase === 'READY' ? 'המשך לדף התשלום הקיים' : 'המשך התשלום הקיים / בדיקת אישור'}</button>}
      {item.canRestart && checks[item.id]?.phase !== 'COMPLETED' && <button type="button" disabled={busy} className="mr-2 min-h-11 rounded-xl border border-slate-400 px-4 py-2 disabled:opacity-50" onClick={() => void act(item, true)}>שחרור בקשה שלא נשלחה ובחירה מחדש</button>}
    </div>)}
    {message && <p role="status" className="text-sm leading-6 text-amber-100">{message}</p>}
    <button type="button" disabled={busy} className="min-h-11 underline underline-offset-4 disabled:opacity-50" onClick={() => { setMessage(''); setRefresh(value => value + 1); }}>רענון בדיקת בקשות</button>
  </section>;
}
