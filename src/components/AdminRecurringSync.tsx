import React, { useState } from 'react';
import { syncRivhitRecurring } from '../data/rivhitPayments';

export function AdminRecurringSync({ userId }: { userId: string }) {
  const [saleId, setSaleId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  return <details className="w-full rounded-xl border border-slate-600 p-3 text-right text-sm">
    <summary className="cursor-pointer font-bold">סנכרון הוראת קבע קיימת מרווחית</summary>
    <p className="my-2">לאחר אישור ההוראה ברווחית: הזן את מזהה עסקת ההקמה (SaleId), לא מזהה דף התשלום. פעולה זו בודקת ומסנכרנת בלבד — ללא חיוב או הקמת הוראה חדשה.</p>
    <label className="block">מזהה עסקת הקמה ברווחית<input dir="ltr" value={saleId} maxLength={100} onChange={event => setSaleId(event.target.value)} className="my-2 min-h-11 w-full rounded-lg border border-slate-500 bg-slate-950 p-2 text-white" /></label>
    <button type="button" disabled={busy || !saleId.trim()} className="min-h-11 w-full rounded-lg bg-amber-400 p-2 font-bold text-black disabled:opacity-50" onClick={async () => {
      setBusy(true); setMessage('');
      try { const result = await syncRivhitRecurring(userId, saleId.trim()); setMessage(result); window.dispatchEvent(new Event('baly:refresh-billing')); }
      catch (error) { setMessage(error instanceof Error ? error.message : 'הסנכרון נכשל. לא נוצר חיוב.'); }
      finally { setBusy(false); }
    }}>{busy ? 'בודק מול רווחית…' : 'בדיקה וסנכרון ללא חיוב'}</button>
    {message && <p role="status" className="mt-2 rounded-lg border border-amber-500 bg-slate-950 p-2 text-amber-100">{message}</p>}
  </details>;
}
