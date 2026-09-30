import { useState } from 'react';
import { User, UserRole } from '../types';
import { deleteServerUser } from '../data/clubServer';

export function DeleteUserControl({ user, users, manager }: { user: User; users: User[]; manager: User }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [successor, setSuccessor] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  if (manager.role !== UserRole.MANAGER || user.role === UserRole.MANAGER) return null;
  const family = users.filter(member => member.id !== user.id && (member.familyPayerId === user.id || (user.isFamilyPayer && user.familyId && member.familyId === user.familyId)));
  const candidates = family.filter(member => member.role === UserRole.TRAINEE && member.age >= 18 && !member.registrationIncomplete);
  const close = () => { if (!pending) { setOpen(false); setPassword(''); setConfirmed(false); setError(''); setSuccessor(''); } };
  return <>
    <button type="button" onClick={() => setOpen(true)} className="min-h-11 rounded-lg border border-red-400 bg-red-950 px-3 text-xs font-bold text-red-100">מחיקת משתמש לצמיתות</button>
    {open && <div className="fixed inset-0 z-[150] grid place-items-center bg-black/80 p-4" dir="rtl">
      <form role="dialog" aria-modal="true" aria-label={`מחיקת המשתמש ${user.name}`} onSubmit={async event => {
        event.preventDefault();
        if (!confirmed || pending || (family.length > 0 && !successor)) return;
        setPending(true); setError('');
        try { await deleteServerUser(user.id, password, successor); setPassword(''); window.location.reload(); }
        catch (err) { setError(err instanceof Error ? err.message : 'המחיקה נכשלה.'); setPending(false); setPassword(''); }
      }} className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-600 bg-zinc-900 p-5 text-right text-zinc-100 shadow-xl">
        <h2 className="text-xl font-bold">מחיקה לצמיתות — {user.name}</h2>
        <p className="my-3 text-sm leading-7">יימחקו החשבון, הפרופיל והצהרות הבריאות, התוכניות האישיות, ההרשמות, ההתכתבויות והתיעוד המשויך למשתמש באפליקציה. החיבורים ינותקו. חזרה למועדון תחייב הרשמה מלאה מחדש.</p>
        <p className="rounded-xl border border-amber-500 bg-amber-950 p-3 text-sm text-amber-100">הפעולה אינה מבטלת חיובים חוזרים, אינה מבצעת החזר ואינה מוחקת חשבוניות ברווחית. יש להסדיר זאת בנפרד לפני המחיקה. גיבויים היסטוריים אינם נמחקים בפעולה זו.</p>
        {family.length > 0 && <label className="mt-4 block text-sm">ראש משפחה חלופי (חובה לפני המחיקה)
          <select required value={successor} onChange={event => setSuccessor(event.target.value)} className="mt-2 min-h-12 w-full rounded-lg border border-zinc-500 bg-zinc-800 p-2 text-white">
            <option value="">בחר בן משפחה בגיר</option>
            {candidates.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select>
          <span className="mt-2 block text-xs">האחריות באפליקציה תועבר לראש המשפחה החדש באותה פעולה. אמצעי תשלום ברווחית לא מועברים אוטומטית.</span>
          {!candidates.length && <span className="block text-red-200">אין בן משפחה בגיר שהשלים הרשמה. יש להסדיר ראש משפחה חלופי לפני המחיקה.</span>}
        </label>}
        <label className="mt-4 block text-sm">סיסמת הכניסה שלך כמנהל
          <input autoFocus required type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} className="mt-2 min-h-12 w-full rounded-lg border border-zinc-500 bg-zinc-800 p-2 text-white" />
        </label>
        <label className="my-4 flex items-start gap-3 text-sm leading-6"><input type="checkbox" required checked={confirmed} onChange={event => setConfirmed(event.target.checked)} className="mt-1 h-5 w-5 shrink-0" />אני מאשר כמנהל את המחיקה ומבין שחיובים חיצוניים דורשים טיפול נפרד.</label>
        {error && <p role="alert" className="mb-3 text-red-200">{error}</p>}
        <div className="flex gap-3"><button disabled={pending || !confirmed || !password || (family.length > 0 && !successor)} className="min-h-12 flex-1 rounded-lg bg-red-700 p-3 font-bold text-white disabled:opacity-40">{pending ? 'מוחק…' : 'אישור ומחיקה לצמיתות'}</button><button type="button" disabled={pending} onClick={close} className="min-h-12 rounded-lg bg-zinc-700 px-5 text-white">ביטול</button></div>
      </form>
    </div>}
  </>;
}
