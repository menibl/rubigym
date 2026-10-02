import React, { useState } from 'react';
import { recoverFamilyPaymentCredit, FamilyCreditRecoveryResult } from '../data/rivhitPayments';

export function FamilyCreditRecoveryControl({ paymentId, reason }: { paymentId: string; reason: string }) {
  const [result, setResult] = useState<FamilyCreditRecoveryResult>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async (action: 'check' | 'release') => {
    if (busy) return;
    if (action === 'release' && !confirm('לשחרר שמירת קיזוז שלא נשלחה לספק? התשלום המקורי לא יימחק ולא יבוצע החזר.')) return;
    setBusy(true); setError(''); setResult(undefined);
    try { setResult(await recoverFamilyPaymentCredit(paymentId, action, reason)); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'הבדיקה נכשלה; אין לבצע חיוב נוסף.'); }
    finally { setBusy(false); }
  };
  return <section className="mt-4 rounded-xl border border-amber-300/50 bg-slate-900 p-3 text-sm text-white" aria-label="שחזור קיזוז משפחתי">
    <h4 className="font-bold">בקשת תשלום משפחתית תקועה</h4>
    <p className="my-2 text-slate-300">בחרו למעלה את התשלום המקורי ששולם. הבדיקה מאמתת עסקה קיימת ומסנכרנת אותה אם שולמה; היא אינה יוצרת חיוב או החזר.</p>
    <button type="button" disabled={busy || !paymentId} onClick={() => run('check')} className="min-h-11 rounded-lg bg-amber-300 px-3 font-bold text-slate-950 disabled:opacity-50">{busy ? 'בודק…' : 'בדיקה וסנכרון קיזוז משפחתי'}</button>
    {result && <p role="status" className="mt-3">{result.message}</p>}
    {result?.diagnostic && <p className="mt-2 text-slate-300">קוד אבחון: <bdi>{result.diagnostic.code}</bdi> · שלב: <bdi>{result.diagnostic.stage}</bdi></p>}
    {result?.state === 'EXISTING_PAGE' && result.url && <a href={result.url} target="_blank" rel="noopener noreferrer" className="mt-3 block underline">פתיחת בקשת התשלום המקורית ברווחית</a>}
    {result?.state === 'RELEASABLE' && <button type="button" disabled={busy || reason.trim().length < 3} onClick={() => run('release')} className="mt-3 min-h-11 rounded-lg border border-amber-300 px-3 disabled:opacity-50">שחרור שמירת קיזוז — נדרשת סיבת פעולה למעלה</button>}
    {error && <p role="alert" className="mt-3 text-rose-200">{error}</p>}
  </section>;
}
