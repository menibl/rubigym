import React, { useState } from 'react';

interface SchedulePreview {
  checkedAt: number; previousPolicyId: string | null; confirmationKey: string;
  preview: { userName: string; planLabel: string; amount: number; successfulCharges: number; endsAt: string;
    approvedBillingDay: number; providerEndDate: string; serviceMonth: string; anchorCharge: number; serviceExpiry: string;
    currentMembershipExpiry: string | null; verifiedPaidUntil: string | null };
}
export function AdminRecurringScheduleApproval({ userId, seriesId }: { userId: string; seriesId: string }) {
  const [anchorCharge, setAnchorCharge] = useState(''), [serviceMonth, setServiceMonth] = useState(''), [reason, setReason] = useState('');
  const [preview, setPreview] = useState<SchedulePreview | null>(null), [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const invalidate = () => { setPreview(null); setAck(false); setMessage(''); };
  const request = async (action: 'preview' | 'confirm') => {
    setBusy(true); setMessage('');
    try {
      const base = (import.meta.env.VITE_PAYMENT_API_URL || window.location.origin).replace(/\/$/, '');
      const response = await fetch(`${base}/api/payments/rivhit/admin/recurring-schedule`, { method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, userId, recurringSaleId: seriesId.trim(),
          anchorCharge: Number(anchorCharge), serviceMonth, reason, checkedAt: preview?.checkedAt,
          previousPolicyId: preview?.previousPolicyId, confirmationKey: preview?.confirmationKey }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'לא ניתן לאשר את השינוי');
      if (action === 'preview') { setPreview(result); setAck(false); }
      else { setPreview(null); setMessage(result.message); window.dispatchEvent(new Event('baly:refresh-billing')); }
    } catch (error) { setPreview(null); setMessage(error instanceof Error ? error.message : 'האישור לא הושלם. לא נוצר חיוב.'); }
    finally { setBusy(false); }
  };
  return <details className="my-3 rounded-lg border border-amber-500 p-3 text-right text-sm">
    <summary className="cursor-pointer font-bold">אישור מנהל לשינוי מועדי חיוב וחודש שירות</summary>
    <p className="my-2">להוראה קיימת שכבר אומתה בלבד. הזן את מזהה הוראת הקבע למעלה. נבדוק את המועדים המעודכנים ברווחית, אך לא נשנה שם דבר ולא נבצע חיוב.</p>
    <p className="my-2">דוגמה: חיוב מספר 2 ב־22/11 עבור חודש 2026-12 ייתן תוקף עד 1/1 רק אחרי אישור החיוב. השיוך מחושב לכל 12 החיובים ויכול לתקן גם תוקף של תשלומים שאומתו בעבר, בלי לשנות סכומים או ליצור קבלות חדשות. בהוראה משפחתית השינוי חל על כל המשתתפים בה.</p>
    <label className="block">מספר החיוב לשיוך (1–12)<input type="number" min="1" max="12" value={anchorCharge} disabled={busy} onChange={e => { setAnchorCharge(e.target.value); invalidate(); }} className="my-2 min-h-11 w-full rounded-lg border border-slate-500 bg-slate-950 p-2 text-white" /></label>
    <label className="block">חודש השירות עבור החיוב הזה<input type="month" value={serviceMonth} disabled={busy} onChange={e => { setServiceMonth(e.target.value); invalidate(); }} className="my-2 min-h-11 w-full rounded-lg border border-slate-500 bg-slate-950 p-2 text-white" /></label>
    <label className="block">סיבת שינוי לוח החיובים<input value={reason} maxLength={500} disabled={busy} onChange={e => { setReason(e.target.value); invalidate(); }} className="my-2 min-h-11 w-full rounded-lg border border-slate-500 bg-slate-950 p-2 text-white" /></label>
    <button type="button" disabled={busy || !seriesId.trim() || !anchorCharge || !serviceMonth || reason.trim().length < 5} onClick={() => request('preview')} className="min-h-11 w-full rounded-lg bg-amber-300 p-2 font-bold text-slate-950 disabled:opacity-40">בדיקת מועדים ושיוך — ללא שינוי או חיוב</button>
    {preview && <section aria-label="תצוגה מקדימה לאישור מועדי חיוב" className="mt-3 rounded-lg bg-slate-950 p-3 text-amber-100">
      <p>{preview.preview.userName} · {preview.preview.planLabel} · ₪{preview.preview.amount} לכל חיוב</p>
      <p>יום החיוב ברווחית: {preview.preview.approvedBillingDay} · מועד סיום ברווחית: <bdi>{preview.preview.providerEndDate}</bdi></p>
      <p>חיוב {preview.preview.anchorCharge} מיועד לחודש <bdi>{preview.preview.serviceMonth}</bdi>; אם יאושר יכסה עד <bdi>{preview.preview.serviceExpiry}</bdi>.</p>
      <p>חיובים שאומתו בפועל: {preview.preview.successfulCharges} · תוקף ששולם לפי השיוך החדש: <bdi>{preview.preview.verifiedPaidUntil || 'טרם שולם'}</bdi></p>
      <p>תוקף המנוי המוצג כעת: <bdi>{preview.preview.currentMembershipExpiry || 'לא הוגדר'}</bdi> · תום 12 חודשי השירות: <bdi>{preview.preview.endsAt}</bdi></p>
      <label className="my-3 flex gap-2"><input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} />אני מאשר את המועדים ואת שיוך חודשי השירות, לרבות עדכון התוקף של חיובים מאומתים קודמים. אין כאן הוראה לחייב.</label>
      <button type="button" disabled={busy || !ack} onClick={() => request('confirm')} className="min-h-11 w-full rounded-lg bg-amber-300 p-2 font-bold text-slate-950 disabled:opacity-40">אישור השינוי באפליקציה — ללא חיוב חדש</button>
    </section>}
    {message && <p role="status" className="mt-2">{message}</p>}
  </details>;
}
