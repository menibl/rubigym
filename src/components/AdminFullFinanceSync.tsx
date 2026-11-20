import React, { useEffect, useRef, useState } from 'react';

interface SyncTask { id: string; name: string; kind: string }
interface SyncResult extends SyncTask { status: 'VERIFIED' | 'PENDING' | 'REVIEW'; message?: string; successfulCharges?: number; nextChargeDate?: string }
async function syncRequest(body: object) {
  const base = (import.meta.env.VITE_PAYMENT_API_URL || window.location.origin).replace(/\/$/, '');
  const response = await fetch(`${base}/api/payments/rivhit/admin/full-sync`, { method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(50_000) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'הסנכרון לא הושלם');
  return result;
}

export function AdminFullFinanceSync() {
  const running = useRef(false), stop = useRef(false);
  const [busy, setBusy] = useState(false), [total, setTotal] = useState(0);
  const [results, setResults] = useState<SyncResult[]>([]), [message, setMessage] = useState('');
  const [finishedAt, setFinishedAt] = useState('');
  useEffect(() => () => { stop.current = true; }, []);
  const run = async () => {
    if (running.current) return;
    running.current = true; stop.current = false; setBusy(true); setResults([]); setMessage(''); setTotal(0); setFinishedAt('');
    try {
      const manifest: { tasks: SyncTask[] } = await syncRequest({ action: 'list' });
      setTotal(manifest.tasks.length);
      // Sequential, one server-owned reference per bounded request. No charge,
      // page creation, contract update or cancel operation is exposed here.
      for (const task of manifest.tasks) {
        if (stop.current) break;
        let result: SyncResult;
        try { result = await syncRequest({ action: 'sync', taskId: task.id }); }
        catch { result = { ...task, status: 'REVIEW', message: 'הבדיקה לא הושלמה. ייתכן שחלק מהנתונים עודכנו; ניתן לבדוק שוב ללא חיוב.' }; }
        setResults(previous => [...previous, result]);
      }
      setFinishedAt(new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }));
      window.dispatchEvent(new Event('baly:refresh-billing'));
      setMessage(stop.current ? 'הסריקה נעצרה. נתונים שכבר סונכרנו נשמרו.' : 'הסריקה הסתיימה. רק חיובים שאומתו נכללים כשולם; יש לעיין גם ברשומות הדורשות בירור.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'לא ניתן להתחיל סנכרון'); }
    finally { running.current = false; setBusy(false); }
  };
  return <section aria-label="סנכרון מלא מול רווחית" className="rounded-xl border border-amber-400/50 bg-slate-950 p-3 text-sm text-white">
    <button type="button" disabled={busy} onClick={run} className="min-h-11 rounded-lg bg-amber-300 px-4 py-2 font-black text-slate-950 disabled:opacity-50">{busy ? `מסנכרן ${results.length}/${total}…` : 'סנכרון מלא מול רווחית — ללא חיוב'}</button>
    {busy && <button type="button" onClick={() => { stop.current = true; }} className="mr-3 min-h-11 underline">עצירה אחרי הבדיקה הנוכחית</button>}
    <p role="status" className="mt-2">{message || 'בדיקת כל ההוראות והעסקאות המקושרות לאתר, לא רק מהיום. ללא יצירת חיוב, דף תשלום או שינוי הוראה ברווחית.'}</p>
    {finishedAt && <p>סיום הבדיקה: <bdi>{finishedAt}</bdi></p>}
    {finishedAt && !busy && <button type="button" className="min-h-11 underline" onClick={() => window.dispatchEvent(new Event('baly:refresh-billing'))}>רענון הסכומים באתר לאחר הסנכרון</button>}
    {(busy || finishedAt) && <p>נבדקו {results.length}/{total} · אומתו {results.filter(item => item.status === 'VERIFIED').length} · ממתינים לחיוב {results.filter(item => item.status === 'PENDING').length} · לבירור {results.filter(item => item.status === 'REVIEW').length}</p>}
    <details className="mt-2"><summary className="cursor-pointer font-bold">היקף הבדיקה ופירוט התוצאות</summary>
      <p className="my-2">נבדקים המזהים השמורים באתר והיסטוריית החיובים של כל הוראה מקושרת, ללא כפילות לבני משפחה. עסקה חיצונית שאין לה בקשה או מזהה מקשר באתר אינה משויכת לפי שם וסכום בלבד. עסקאות בדיקה אינן מסונכרנות ואינן נכללות בסכומים. חוסר תשובה אינו דחיית תשלום, והסריקה אינה משחררת בקשות תקועות.</p>
      {results.map(item => <p key={item.id} className="my-2">{item.name} — {item.status === 'VERIFIED' ? 'אומת וסונכרן' : item.status === 'PENDING' ? 'הוראה מאומתת; טרם התקבל אישור חיוב' : item.message || 'נדרש בירור'}{item.nextChargeDate && <> · חיוב הבא: <bdi>{item.nextChargeDate}</bdi></>}</p>)}
    </details>
  </section>;
}
