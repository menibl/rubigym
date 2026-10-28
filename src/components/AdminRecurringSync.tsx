import React, { useState } from 'react';
import { syncRivhitRecurring, syncRivhitRecurringId, type RecurringSyncPreview } from '../data/rivhitPayments';

export function AdminRecurringSync({ userId }: { userId: string }) {
  const [saleId, setSaleId] = useState('');
  const [identifierType, setIdentifierType] = useState<'RECURRING' | 'SALE'>('RECURRING');
  const [preview, setPreview] = useState<{ data: RecurringSyncPreview; key: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  return <details className="w-full rounded-xl border border-slate-600 p-3 text-right text-sm">
    <summary className="cursor-pointer font-bold">סנכרון הוראת קבע קיימת מרווחית</summary>
    <p className="my-2">העתק את ״מזהה הו״ק״ מתוך הוראת הקבע ב־iCredit ← לוג ← יצירת הוראת קבע. זה אינו מזהה דף התשלום. פעולה זו בודקת ומסנכרנת בלבד — ללא חיוב או הקמת הוראה חדשה.</p>
    <label className="block">סוג המזהה<select value={identifierType} onChange={event => { setIdentifierType(event.target.value as 'RECURRING' | 'SALE'); setPreview(null); setMessage(''); }} className="my-2 min-h-11 w-full rounded-lg border border-slate-500 bg-slate-950 p-2 text-white"><option value="RECURRING">מזהה הוראת קבע מהלוג — מומלץ</option><option value="SALE">מזהה עסקה — SaleId</option></select></label>
    <label className="block">{identifierType === 'RECURRING' ? 'מזהה הוראת קבע — RecurringId' : 'מזהה עסקה — SaleId'}<input dir="ltr" value={saleId} maxLength={100} onChange={event => { setSaleId(event.target.value); setPreview(null); setMessage(''); }} className="my-2 min-h-11 w-full rounded-lg border border-slate-500 bg-slate-950 p-2 text-white" /></label>
    <button type="button" disabled={busy || !saleId.trim()} className="min-h-11 w-full rounded-lg bg-amber-400 p-2 font-bold text-black disabled:opacity-50" onClick={async () => {
      setBusy(true); setMessage('');
      try {
        if (identifierType === 'RECURRING') {
          const result = await syncRivhitRecurringId(userId, saleId.trim());
          if (!result.preview || !result.confirmationKey) throw new Error('לא התקבל סיכום מאומת מרווחית. לא שונה דבר.');
          setPreview({ data: result.preview, key: result.confirmationKey });
        } else { setMessage(await syncRivhitRecurring(userId, saleId.trim())); window.dispatchEvent(new Event('baly:refresh-billing')); }
      }
      catch (error) { setPreview(null); setMessage(error instanceof Error ? error.message : 'הסנכרון נכשל. לא נוצר חיוב.'); }
      finally { setBusy(false); }
    }}>{busy ? 'בודק מול רווחית…' : identifierType === 'RECURRING' ? 'בדיקת ההוראה — ללא שינוי או חיוב' : 'בדיקה וסנכרון ללא חיוב'}</button>
    {preview && <section className="mt-3 rounded-lg border border-amber-500 bg-slate-950 p-3 text-amber-100" aria-label="סיכום הוראת קבע לפני סנכרון">
      <p className="font-bold">{preview.data.userName} · {preview.data.planLabel}</p>
      <p>סכום לכל חיוב: ₪{preview.data.amount} · 12 חיובים בסדרה</p>
      <p>חיובים מוצלחים מאומתים: {preview.data.successfulCharges}{preview.data.successfulCharges === 0 ? ' — טרם שולם, ההוראה בלבד אושרה' : ''}</p>
      <p>תוקף התקשרות: <bdi>{preview.data.endsAt}</bdi></p>
      {preview.data.nextChargeDate && <p>מועד חיוב הבא לפי רווחית: <bdi>{preview.data.nextChargeDate}</bdi></p>}
      {!preview.data.discountRecorded && <p>קוד הנחה מקורי לא תועד בבקשה הישנה; סכום ההוראה אומת מול רווחית.</p>}
      <button type="button" disabled={busy} className="mt-3 min-h-11 w-full rounded-lg bg-amber-400 p-2 font-bold text-black disabled:opacity-50" onClick={async () => {
        setBusy(true); setMessage('');
        try { const result = await syncRivhitRecurringId(userId, saleId.trim(), preview.key); setMessage(result.message || 'הסנכרון הושלם ללא חיוב חדש.'); setPreview(null); window.dispatchEvent(new Event('baly:refresh-billing')); }
        catch (error) { setPreview(null); setMessage(error instanceof Error ? error.message : 'הסנכרון נכשל. יש לבדוק מחדש.'); }
        finally { setBusy(false); }
      }}>אישור שיוך ועדכון המנוי — ללא חיוב חדש</button>
    </section>}
    {message && <p role="status" className="mt-2 rounded-lg border border-amber-500 bg-slate-950 p-2 text-amber-100">{message}</p>}
  </details>;
}
