import React, { useState } from 'react';
import { releaseStuckRecurringCheckout } from '../data/rivhitPayments';

export function AdminStuckCheckoutRelease({ userId, orderId, onReleased }: { userId: string; orderId: string; onReleased: () => void }) {
  const [preview, setPreview] = useState<{ checkedAt: number; confirmationKey: string } | null>(null);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const [password, setPassword] = useState(''), [reason, setReason] = useState(''), [reference, setReference] = useState('');
  const [noCharge, setNoCharge] = useState(false), [closedPage, setClosedPage] = useState(false);
  return <details className="mt-3 rounded-lg border border-rose-400 bg-slate-950 p-3 text-slate-100">
    <summary className="cursor-pointer font-bold">שחרור מבוקר של בקשה תקועה — מנהל בלבד</summary>
    <p className="my-2">אין שחרור אוטומטי בגלל כשל אימות. הפעולה אינה מבטלת הוראות או דפים ברווחית. יש להשלים בירור מול רווחית שהדף הישן לא נוצר, בוטל או פג ואינו מאפשר תשלום, ושאין חיוב או הוראה עבור הבקשה.</p>
    <p className="my-2">בבקשה משפחתית, השחרור יחסום רק את פריט התשלום שנבחר וישאיר תשלומים והוראות של שאר בני המשפחה ללא שינוי. לא מסמנים כאן מנוי כשולם.</p>
    <button type="button" disabled={busy} className="min-h-11 w-full rounded-lg border border-amber-400 p-2" onClick={async () => {
      setBusy(true); setPreview(null); setMessage(''); setPassword('');
      try { const result = await releaseStuckRecurringCheckout({ action: 'preview', userId, orderId }); setPreview(result); setMessage(result.message); }
      catch (error) { setMessage(error instanceof Error ? error.message : 'הבדיקה נכשלה. לא שוחררה בקשה.'); }
      finally { setBusy(false); }
    }}>{busy ? 'בודק…' : 'בדיקה מקדימה לשחרור — ללא שינוי'}</button>
    {preview && <form className="mt-3 space-y-3" onSubmit={async event => {
      event.preventDefault();
      if (!window.confirm('לשחרר את הבקשה המקומית על סמך הבירור המתועד? יש לוודא שהדף הישן אינו שמיש. לא יבוצע חיוב או ביטול ברווחית.')) return;
      setBusy(true); setMessage('');
      try {
        const result = await releaseStuckRecurringCheckout({ action: 'confirm', userId, orderId, ...preview,
          password, reason, providerReference: reference, oldPageUnusable: closedPage, noChargeOrInstruction: noCharge });
        setMessage(result.message); setPreview(null); setReason(''); setReference(''); setNoCharge(false); setClosedPage(false);
        window.dispatchEvent(new Event('baly:refresh-billing')); onReleased();
      } catch (error) { setPreview(null); setMessage(error instanceof Error ? error.message : 'השחרור לא הושלם.'); }
      finally { setPassword(''); setBusy(false); }
    }}>
      <label className="block">סיבת השחרור<textarea required minLength={10} maxLength={300} disabled={busy} value={reason} onChange={event => setReason(event.target.value)} className="mt-1 w-full rounded-lg bg-slate-800 p-2 text-white" /></label>
      <label className="block">אסמכתת בירור מול רווחית (מספר פנייה ותאריך)<input required minLength={10} maxLength={200} disabled={busy} value={reference} onChange={event => setReference(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg bg-slate-800 p-2 text-white" /></label>
      <p>אין להזין פרטי אשראי או מפתחות API. האסמכתה היא הצהרת מנהל מתועדת, לא אישור אוטומטי מרווחית.</p>
      <label className="flex items-start gap-2"><input required type="checkbox" disabled={busy} checked={noCharge} onChange={event => setNoCharge(event.target.checked)} />וידאתי מול רווחית שלא נוצרו חיוב או הוראת קבע עבור בקשה זו</label>
      <label className="flex items-start gap-2"><input required type="checkbox" disabled={busy} checked={closedPage} onChange={event => setClosedPage(event.target.checked)} />וידאתי מול רווחית שהדף הישן לא נוצר או שאינו שמיש לתשלום נוסף</label>
      <label className="block">סיסמת הכניסה של המנהל<input required type="password" autoComplete="current-password" maxLength={1024} disabled={busy} value={password} onChange={event => setPassword(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg bg-slate-800 p-2 text-white" /></label>
      <button type="submit" disabled={busy || !noCharge || !closedPage || reason.trim().length < 10 || reference.trim().length < 10 || !password} className="min-h-11 w-full rounded-lg border border-rose-400 p-2 text-rose-100 disabled:opacity-50">אישור שחרור הבקשה — ללא חיוב חדש</button>
    </form>}
    {message && <p role="status" className="mt-3">{message}</p>}
  </details>;
}
