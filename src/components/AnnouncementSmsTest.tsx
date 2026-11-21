import React, { useState } from 'react';
import { announcementSmsTest, type AnnouncementSmsTestResult } from '../data/clubServer';

export function AnnouncementSmsTest({ announcementId }: { announcementId: string }) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AnnouncementSmsTestResult | null>(null);
  const [notice, setNotice] = useState('');
  const run = async (send: boolean) => {
    if (busy) return;
    setBusy(true); setNotice('');
    try {
      const input = { announcementId, phone };
      let next = await announcementSmsTest({ ...input, action: 'preview' });
      setResult(next);
      if (send && !next.delivery) {
        if (!window.confirm(`לשלוח עותק בדיקה אחד למספר ${phone}, ולא לקהל המועדון? ייתכן חיוב על מקטעי SMS.\n\n${next.text}`)) return;
        next = await announcementSmsTest({ ...input, action: 'send', confirmed: true, fingerprint: next.fingerprint });
        setResult(next);
      }
      setNotice(next.delivery ? 'מצב הבדיקה הקיימת מוצג. לא נפתחת שליחה נוספת בלחיצה חוזרת.' : 'טרם נוצרה בדיקה למודעה ולמספר הזה. לא נשלחה הודעה.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'בדיקת SMS נכשלה.'); }
    finally { setBusy(false); }
  };
  const delivery = result?.delivery;
  const label = delivery?.status === 'ACCEPTED' ? 'התקבל אצל הספק — לא אישור מסירה למכשיר'
    : delivery?.status === 'FAILED_OR_UNKNOWN' ? 'נכשל או לא ידוע — אין לשלוח שוב ללא בירור'
      : delivery?.status === 'CANCELLED' ? 'הבדיקה בוטלה'
        : delivery ? 'ממתין או בעיבוד — יש לרענן מצב, לא לשלוח שוב' : '';
  return <section className="mt-3 rounded-xl border border-slate-500 p-3 text-sm" aria-label="בדיקת SMS למספר בודד">
    <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}>בדיקת SMS למספר בודד</button>
    {open && <div className="mt-3 space-y-3">
      <p>הנוסח של מודעה זו יישלח רק למספר שתזינו, לא לקהל המועדון. הבדיקה אינה מפרסמת מודעה נוספת ואינה מאפסת שליחות ישנות.</p>
      <label className="block">מספר נייד לבדיקה
        <input type="tel" value={phone} onChange={event => { setPhone(event.target.value); setResult(null); setNotice(''); }} disabled={busy}
          className="block min-h-11 w-full rounded border border-slate-500 bg-slate-950 p-2 text-white" />
      </label>
      <button type="button" disabled={busy || !phone.trim()} onClick={() => void run(false)} className="min-h-11 rounded border p-2">רענן מצב בדיקה — ללא שליחה</button>
      <button type="button" disabled={busy || !phone.trim() || Boolean(delivery)} onClick={() => void run(true)} className="min-h-11 rounded border p-2">שלח בדיקת SMS למספר הזה בלבד</button>
      {busy && <p role="status">בודק…</p>}
      {notice && <p role="status">{notice}</p>}
      {delivery && <div className="space-y-2">
        <p>{label} · מספר מסתיים ב־{result?.phoneSuffix}</p>
        <p>מזהה בדיקה בספק: <span dir="ltr">{delivery.providerReference}</span></p>
        {delivery.diagnostic && <>
          <p>{delivery.diagnostic.reason} · HTTP {delivery.diagnostic.httpStatus ?? 'לא התקבלה תשובה'}</p>
          <p>קוד: {delivery.diagnostic.code || 'לא נקלט'} · סטטוס ספק: {delivery.diagnostic.status || 'לא נקלט'}</p>
          <p>{delivery.diagnostic.message || 'לא נקלט תיאור שגיאה בשדות המזוהים.'}</p>
          <details><summary>פרטי תשובה מסוננים</summary><pre dir="ltr" className="whitespace-pre-wrap break-all">{JSON.stringify(delivery.diagnostic.details || [], null, 2)}</pre></details>
          {delivery.diagnostic.truncated && <p>הפירוט הוגבל בגודל מטעמי בטיחות.</p>}
        </>}
      </div>}
    </div>}
  </section>;
}
