import React, { useEffect, useRef, useState } from 'react';
import { type User } from '../types';
import { manageFamilyPayerTransfer, type FamilyPayerTransferResult } from '../data/clubServer';

export function AdminFamilyPayerTransfer({ user, users, onClose }: { user: User; users: User[]; onClose: () => void }) {
  const [toId, setToId] = useState('');
  const [result, setResult] = useState<FamilyPayerTransferResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLElement>('button, select')?.focus();
    return () => previous?.focus();
  }, []);
  const run = async (action: 'preview' | 'confirm' | 'status') => {
    if (busy) return;
    if (action === 'confirm' && (!result?.token || !window.confirm(`להעביר את ניהול המשפחה מ־${result.preview?.fromName} ל־${result.preview?.toName}, כולל הרשאות ניהול בני המשפחה והשם בחשבוניות העתידיות?\nאותו כרטיס, אותה הוראת קבע, ללא חיוב וללא שינוי במנויים. שינוי השם ברווחית יוצג כהושלם רק לאחר אימות הספק.`))) return;
    setBusy(true); setError('');
    try {
      const next = await manageFamilyPayerTransfer(action === 'preview' ? { action, fromId: user.id, toId }
        : action === 'confirm' ? { action, token: result!.token, confirmed: true } : { action, userId: user.id });
      setResult(next);
    } catch (err) { setError(err instanceof Error ? err.message : 'לא ניתן להשלים את הפעולה. יש לבדוק את מצב ההעברה לפני ניסיון נוסף.'); }
    finally { setBusy(false); }
  };
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-3" dir="rtl">
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="family-payer-title" aria-busy={busy}
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); if (!busy) onClose(); }
        if (event.key !== 'Tab') return;
        const controls = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),select:not(:disabled)');
        if (!controls?.length) return;
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }} className="trainee-admin-editor mx-auto my-6 max-w-xl space-y-4 rounded-2xl border p-5 text-right">
      <h3 id="family-payer-title" className="text-xl font-bold">החלפת משלם משפחתי וחשבוניות</h3>
      <p>העברת ניהול המשפחה והרשאותיה, ושם הלקוח בחשבוניות העתידיות בלבד. לא משנים שם משתמש, סיסמה, כרטיס, סכום, יום חיוב, מסלול, יתרות או תוקף של אף בן משפחה.</p>
      <p>עסקאות וחשבוניות קודמות והמשלם ההיסטורי נשמרים. אין לפתוח הוראת קבע חדשה לצורך ההעברה.</p>
      <p>כתובת הדוא״ל והטלפון השמורים ברווחית נשארים ללא שינוי. שינוי יעד משלוח החשבוניות דורש טיפול נפרד.</p>
      {!result?.transfer && <>
        <p>ראש המשפחה הנוכחי: {user.name}</p>
        <label className="block">משלם חדש מתוך המשפחה
          <select value={toId} disabled={busy || !user.isFamilyPayer} onChange={event => { setToId(event.target.value); setResult(null); }} className="mt-1 w-full rounded-xl border p-3">
            <option value="">בחירת בן משפחה</option>
            {users.filter(member => member.id !== user.id && member.familyId === user.familyId && member.role === 'TRAINEE').map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select>
        </label>
        <button type="button" disabled={busy || !toId || !user.isFamilyPayer} onClick={() => void run('preview')} className="rounded-xl border px-4 py-3 disabled:opacity-50">בדיקה ותצוגה מקדימה — ללא שינוי</button>
        {result?.preview && <section aria-label="תצוגה מקדימה להעברת משלם" className="space-y-2 rounded-xl border p-3">
          <p><strong>מ־{result.preview.fromName} ל־{result.preview.toName}</strong></p>
          <p>שם בחשבוניות העתידיות: {result.preview.toName}</p>
          <p>בני המשפחה שמנוייהם נשמרים: {result.preview.members.map(member => member.name).join(', ')}</p>
          <p>{result.preview.instructions.length} הוראות קיימות המקושרות במערכת — ללא יצירת הוראה נוספת</p>
          {!result.preview.instructions.length && <p>לא נמצאו הוראות מקושרות לסנכרון. אין בכך אישור שאין הוראה חיצונית ברווחית; יש לוודא שלא נשארה הוראה לא משויכת.</p>}
          {result.preview.instructions.map(item => <p key={item.seriesId}>₪{item.amount} לכל חיוב — ללא שינוי · השם הנוכחי ברווחית: {item.currentInvoiceName}</p>)}
          <button type="button" disabled={busy} onClick={() => void run('confirm')} className="rounded-xl bg-amber-400 px-4 py-3 font-bold text-black disabled:opacity-50">אישור העברת המשלם ושם החשבוניות</button>
        </section>}
      </>}
      {result?.transfer && <section role="status" className="space-y-2 rounded-xl border p-3">
        <strong>{result.transfer.managementStatus === 'APPLIED' ? `ניהול המשפחה הועבר ל־${result.transfer.toName}` : 'שיוך ראש המשפחה דורש בדיקת מנהל — אין אישור שההעברה הושלמה'}</strong>
        <p>{result.transfer.status === 'COMPLETE' ? result.transfer.series.length ? 'שם החשבוניות אומת בהוראות הקבע ברווחית. ההעברה הושלמה.' : 'ניהול המשפחה הועבר. אין הוראות מקושרות לעדכון; הוראות שאינן משויכות לא נבדקו ברווחית.'
          : result.transfer.status === 'REVIEW_REQUIRED' ? 'שם החשבוניות עדיין לא סונכרן — נדרשת בדיקת מנהל. לא נפתח חיוב חדש.'
            : 'שם החשבוניות ממתין לעדכון ואימות ברווחית. מתבצעת בדיקה אוטומטית ברקע; עדיין אין אישור להשלמת העדכון ברווחית.'}</p>
        {result.transfer.series.map(item => <p key={item.seriesId}>{item.status === 'SYNCED' ? 'השם אומת ברווחית' : item.status === 'REVIEW_REQUIRED' ? 'נדרשת בדיקת מנהל' : 'ממתין לסנכרון'}{item.code ? ` · ${item.code}` : ''}{item.name ? ` · ${item.name}` : ''}</p>)}
      </section>}
      <button type="button" disabled={busy} onClick={() => void run('status')} className="rounded-xl border px-4 py-3">בדיקת מצב ההעברה — ללא שינוי</button>
      {error && <p role="alert" className="text-rose-300">{error}</p>}
      <button type="button" disabled={busy} onClick={onClose} className="rounded-xl border px-4 py-3">סגירה</button>
    </div>
  </div>;
}
