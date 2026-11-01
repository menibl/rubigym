import React, { useState } from 'react';

interface RecoveryItem { orderId: string; name: string; status: string; code: string; plan?: string; amount?: number; charges?: number; endsAt?: string }
interface RecoveryPreview { day: string; items: RecoveryItem[]; checkedAt: number; confirmationKey: string }
const reasons: Record<string, string> = {
  PHONE_MISSING: 'חסר מספר טלפון תקין', ORIGINAL_ORDER_MISSING: 'חסרה בקשת הקמה מקורית לאימות',
  AMBIGUOUS_SERIES: 'נמצאו כמה הוראות מתאימות — לא שויך אוטומטית', SERIES_MATCHES_MULTIPLE_ORDERS: 'אותה הוראה מתאימה לכמה בקשות — נדרש בירור',
  AMBIGUOUS_PEER_ORDER: 'בקשה נוספת באותו טלפון ובסכום דומה לא אומתה — אין לשייך על סמך בדיקה חלקית',
  NO_VERIFIED_MATCH: 'לא נמצאה התאמה מאומתת לבקשה', PROVIDER_LIST_UNAVAILABLE: 'רשימת ההוראות לא זמינה כרגע',
  PROVIDER_DETAILS_UNAVAILABLE: 'לא התקבלו כל פרטי ההוראות; אין להסיק שהתשלום נדחה', HISTORY_OR_TERMS_REQUIRE_REVIEW: 'היסטוריית החיובים או תנאי ההוראה דורשים בדיקה',
  APPLY_REQUIRES_REVIEW: 'העדכון דורש בדיקה חוזרת; ייתכן שחלק מהמידע כבר סונכרן',
  PAID_VERIFIED: 'סונכרן — חיוב אושר', PENDING_FIRST_CHARGE: 'סונכרן — המנוי פעיל וממתין לאישור חיוב'
};
async function recover(action: 'preview' | 'confirm', preview?: RecoveryPreview) {
  const base = (import.meta.env.VITE_PAYMENT_API_URL || window.location.origin).replace(/\/$/, '');
  const response = await fetch(`${base}/api/payments/rivhit/admin/recurring-recovery`, { method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, checkedAt: preview?.checkedAt, confirmationKey: preview?.confirmationKey }) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || 'לא ניתן להשלים בדיקה. לא נפתח חיוב נוסף.');
  return result;
}
export function AdminBulkRecurringRecovery() {
  const [preview, setPreview] = useState<RecoveryPreview | null>(null);
  const [results, setResults] = useState<RecoveryItem[]>([]);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  return <section className="mb-6 rounded-xl border border-amber-600 bg-slate-950 p-4 text-sm text-amber-100" aria-label="שחזור מרוכז של הוראות מהיום">
    <h3 className="font-bold">סנכרון מרוכז — הוראות קבע שנפתחו היום</h3>
    <p className="my-2">בדיקת הוראות קיימות ברווחית מול הבקשות שנשמרו באפליקציה. אין יצירת הוראה, חיוב או החזר. הקמת הוראה מאומתת פותחת הרשמה בהמתנה לחיוב הראשון; אינה יוצרת קבלה פיקטיבית.</p>
    <button type="button" disabled={busy} className="min-h-11 rounded-lg bg-amber-400 p-3 font-bold text-black disabled:opacity-50" onClick={async () => {
      setBusy(true); setMessage(''); setPreview(null); setResults([]);
      try { setPreview(await recover('preview')); }
      catch (error) { setMessage(error instanceof Error ? error.message : 'הבדיקה נכשלה'); }
      finally { setBusy(false); }
    }}>{busy ? 'בודק מול רווחית…' : 'בדיקת הוראות היום — ללא שינוי'}</button>
    {preview && <div className="mt-3 space-y-2">
      <p>תאריך בישראל: <bdi>{preview.day}</bdi> · התאמות שאומתו: {preview.items.filter(item => item.status === 'VERIFIED').length} מתוך {preview.items.length}</p>
      {preview.items.map(item => <p key={item.orderId}>{item.name} — {item.status === 'VERIFIED' ? `${item.plan}, ₪${item.amount}, תוקף ${item.endsAt}; ${item.charges ? `${item.charges} חיובים מאומתים` : 'הוראה אושרה, טרם התקבל חיוב'}` : reasons[item.code] || 'נדרש בירור ללא חיוב נוסף'}</p>)}
      {preview.items.some(item => item.status === 'VERIFIED') && <button type="button" disabled={busy} className="min-h-11 rounded-lg bg-amber-400 p-3 font-bold text-black disabled:opacity-50" onClick={async () => {
        setBusy(true); setMessage('');
        try { const result = await recover('confirm', preview); setResults(result.results); setPreview(null); setMessage(result.message); window.dispatchEvent(new Event('baly:refresh-billing')); }
        catch (error) { setPreview(null); setMessage(error instanceof Error ? error.message : 'הסנכרון דורש בירור'); }
        finally { setBusy(false); }
      }}>אישור סנכרון ההתאמות המאומתות בלבד — ללא חיוב חדש</button>}
    </div>}
    {results.map(item => <p key={item.orderId} className="mt-2">{item.name} — {reasons[item.code] || 'נדרש בירור'}</p>)}
    {message && <p role="status" className="mt-2">{message}</p>}
  </section>;
}
