import React, { useState } from 'react';
import { adminRecurringCheckout, type RecurringCheckoutItem } from '../data/rivhitPayments';
import { AdminStuckCheckoutRelease } from './AdminStuckCheckoutRelease';

export function AdminRecurringRequests({ userId }: { userId: string }) {
  const [items, setItems] = useState<RecurringCheckoutItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const run = async (action: 'list' | 'inspect' | 'release' = 'list', item?: RecurringCheckoutItem) => {
    let reason: string | undefined;
    if (action === 'release') {
      if (!window.confirm('לשחרר בקשה שהשרת מאמת שלא נשלחה כלל לרווחית? דף תשלום שנשלח או שמצבו לא ידוע לא ישוחרר.')) return;
      reason = window.prompt('סיבה לשחרור הבקשה (לפחות 10 תווים):')?.trim();
      if (!reason || reason.length < 10) { setMessage('יש להזין סיבה מפורטת. לא שונה דבר.'); return; }
    }
    setBusy(true); setMessage('');
    try {
      const result = await adminRecurringCheckout(userId, action, item?.orderId, reason);
      if (result.items) setItems(result.items);
      if (result.message) setMessage(result.message);
      if (action === 'release') { setItems((await adminRecurringCheckout(userId)).items || []); window.dispatchEvent(new Event('baly:refresh-billing')); }
      if (action === 'inspect') window.dispatchEvent(new Event('baly:refresh-billing'));
    } catch (error) { setMessage(error instanceof Error ? error.message : 'הבדיקה נכשלה. לא נפתח חיוב נוסף.'); }
    finally { setBusy(false); }
  };
  return <details className="w-full rounded-xl border border-slate-600 p-3 text-right text-sm">
    <summary className="cursor-pointer font-bold">בדיקת בקשות תשלום פתוחות / תקועות</summary>
    <p className="my-2">בקשת דף אינה אישור תשלום. בדיקה לא פותחת דף חדש ולא מחייבת. המתאמן יכול ללחוץ שוב על תשלום כדי להמשיך את הדף השמור.</p>
    <button type="button" disabled={busy} onClick={() => void run()} className="min-h-11 w-full rounded-lg bg-amber-400 p-2 font-bold text-black disabled:opacity-50">{busy ? 'בודק…' : 'הצגת בקשות קיימות'}</button>
    {items?.length === 0 && <p className="mt-2">לא נמצאו בקשות פתוחות למתאמן.</p>}
    {items?.map(item => <section key={item.orderId} className="mt-3 rounded-lg border border-slate-500 bg-slate-950 p-3 text-slate-100">
      <p className="font-bold">{item.label}{item.amount !== undefined ? ` · ₪${item.amount}` : ''}</p>
      <p>נפתחה: <bdi>{item.createdAt.slice(0, 10)}</bdi></p>
      <p>{item.stage === 'RESERVED' ? 'בהכנה — טרם נשלחה לרווחית' : item.stage === 'PAGE_AVAILABLE' ? 'דף תשלום קיים שמור להמשך' : 'נשלחה או בקשה ישנה — נדרשת בדיקה, אין לשחרר לפי זמן בלבד'}</p>
      <button type="button" disabled={busy} onClick={() => void run('inspect', item)} className="mt-2 min-h-11 w-full rounded-lg border border-amber-400 p-2 text-amber-100">בדיקה וסנכרון מול רווחית — ללא חיוב</button>
      {item.canRelease && <button type="button" disabled={busy} onClick={() => void run('release', item)} className="mt-2 min-h-11 w-full rounded-lg border border-rose-400 p-2 text-rose-100">שחרור בקשה שלא נשלחה</button>}
      {!item.canRelease && <AdminStuckCheckoutRelease userId={userId} orderId={item.orderId} onReleased={() => void run('list')} />}
    </section>)}
    {message && <p role="status" className="mt-3 rounded-lg border border-amber-500 bg-slate-950 p-3 text-amber-100">{message}</p>}
  </details>;
}
