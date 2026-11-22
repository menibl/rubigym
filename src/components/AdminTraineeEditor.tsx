import React, { useEffect, useRef, useState } from 'react';
import { Gender, User } from '../types';
import { assignTraineeFamily } from '../../shared/admin-trainees.js';
import { prepareProfileImage } from '../utils/profileImage';
import { hasFullPersonName } from '../../shared/person-name.js';
import { validateUsernameChange } from '../../shared/username-change.js';
import { renameTraineeUsername } from '../data/clubServer';

export function AdminTraineeEditor({ user, users, onSave, onClose }: {
  user: User; users: User[]; onSave: (users: User[]) => void; onClose: () => void;
}) {
  const [draft, setDraft] = useState({ name: user.name, username: user.username || '', email: user.email || '', phone: user.phone || '', gender: user.gender || Gender.ALL, birthDate: user.birthDate || '', payerId: user.familyPayerId || (user.isFamilyPayer ? user.id : '') });
  const [error, setError] = useState('');
  const [imageUrl, setImageUrl] = useState(user.imageUrl);
  const [imageProcessing, setImageProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const dialogRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLInputElement>('input')?.focus();
    return () => previousFocus?.focus();
  }, []);
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (imageProcessing || saving) return;
    try {
      if (!hasFullPersonName(draft.name)) throw new Error('יש להזין שם פרטי ושם משפחה בשדה השם המלא לחשבונית. שם המשתמש אינו שם משפחה.');
      if (!draft.username.trim()) throw new Error('יש להזין שם משתמש לכניסה.');
      if (draft.username.trim() !== (user.username || '')) validateUsernameChange(users, user.id, draft.username);
      const normalizedPhone = draft.phone.replace(/\D/g, '').replace(/^972/, '0');
      if (draft.phone && !/^05\d{8}$/.test(normalizedPhone)) throw new Error('יש להזין מספר נייד ישראלי תקין.');
      if (users.some(member => member.id !== user.id && ((draft.username && member.username?.toLowerCase() === draft.username.trim().toLowerCase()) || (normalizedPhone && member.phone?.replace(/\D/g, '').replace(/^972/, '0') === normalizedPhone)))) throw new Error('שם המשתמש או הטלפון שייכים למשתמש אחר.');
      const today = new Date();
      const birth = draft.birthDate ? new Date(`${draft.birthDate}T00:00:00`) : null;
      if (birth && (!Number.isFinite(birth.getTime()) || birth > today)) throw new Error('תאריך הלידה אינו תקין.');
      const age = birth ? today.getFullYear() - birth.getFullYear() - (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate()) ? 1 : 0) : user.age;
      const updated = users.map(member => member.id === user.id ? { ...member, imageUrl, name: draft.name.trim(), username: draft.username.trim(), email: draft.email.trim().toLowerCase(), phone: normalizedPhone, gender: draft.gender, birthDate: draft.birthDate || undefined, age } : member);
      const linked = assignTraineeFamily(updated, user.id, draft.payerId);
      const edited = linked.find(member => member.id === user.id);
      if (draft.email && linked.some(member => member.id !== user.id && member.email?.toLowerCase() === draft.email.trim().toLowerCase() && (!edited.familyId || member.familyId !== edited.familyId))) throw new Error('כתובת הדוא״ל שייכת למשתמש מחוץ למשפחה.');
      setSaving(true);
      if (draft.username.trim() !== (user.username || '')) await renameTraineeUsername(user.id, draft.username.trim());
      onSave(linked);
      onClose();
    } catch (err) { setError(err instanceof Error ? err.message : 'לא ניתן לשמור.'); }
    finally { setSaving(false); }
  };
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-3" dir="rtl">
    <form ref={dialogRef} onSubmit={save} onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); if (!saving) onClose(); }
      if (event.key !== 'Tab') return;
      const controls = dialogRef.current?.querySelectorAll<HTMLElement>('input, select, button');
      if (!controls?.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }} role="dialog" aria-modal="true" aria-labelledby="trainee-edit-title" className="trainee-admin-editor mx-auto my-6 max-w-xl rounded-2xl border p-5">
      <h3 id="trainee-edit-title" className="text-xl font-bold">עריכת פרטי {user.name}</h3>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <img src={imageUrl} alt={`תמונת הפרופיל של ${user.name}`} className="h-20 w-20 rounded-full object-cover" />
        <label className="text-sm">החלפת תמונת פרופיל
          <input type="file" accept="image/*" disabled={imageProcessing} className="mt-1 block w-full max-w-xs rounded-xl border p-2" onChange={async event => {
            const input = event.currentTarget;
            const file = input.files?.[0];
            if (!file) return;
            setImageProcessing(true);
            setError('');
            try { setImageUrl(await prepareProfileImage(file)); }
            catch (err) { setError(err instanceof Error ? err.message : 'לא ניתן לעבד את התמונה.'); }
            finally { setImageProcessing(false); input.value = ''; }
          }} />
        </label>
        <p role="status" className="text-xs">{imageProcessing ? 'מכין את התמונה…' : 'התמונה תוקטן אוטומטית. לסיום לחץ שמור פרטים.'}</p>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {(['name', 'username', 'email', 'phone', 'birthDate'] as const).map(key => <label key={key} className="text-sm">{{ name: 'שם מלא לחשבונית — פרטי ומשפחה', username: 'שם משתמש לכניסה — ניתן לשינוי', email: 'דוא״ל', phone: 'טלפון', birthDate: 'תאריך לידה' }[key]}<input required={key === 'name' || key === 'username'} autoComplete={key === 'username' ? 'off' : undefined} type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : key === 'birthDate' ? 'date' : 'text'} value={draft[key]} onChange={event => setDraft({ ...draft, [key]: event.target.value })} className="mt-1 w-full rounded-xl border p-3" /></label>)}
        <label>מין<select value={draft.gender} onChange={event => setDraft({ ...draft, gender: event.target.value as Gender })} className="mt-1 w-full rounded-xl border p-3"><option value={Gender.ALL}>לא הוגדר</option><option value={Gender.MALE}>זכר</option><option value={Gender.FEMALE}>נקבה</option></select></label>
        <label className="sm:col-span-2">שיוך למשפחה — הגורם המשלם<select value={draft.payerId} onChange={event => setDraft({ ...draft, payerId: event.target.value })} className="mt-1 w-full rounded-xl border p-3"><option value="">ללא משפחה — משלם עצמאי</option>{users.filter(member => member.isFamilyPayer && member.familyId).map(payer => <option key={payer.id} value={payer.id}>{payer.familyName || 'משפחה'} — {payer.name}</option>)}</select></label>
      </div>
      <p className="mt-3 text-sm">השם המלא משמש לחשבוניות חדשות. שם המשתמש משמש לכניסה בלבד; שינויו אינו משנה סיסמה, תשלומים או מנויים. יש לעדכן את המתאמן בשם המשתמש החדש. חשבוניות ודפי תשלום שכבר נוצרו ופרטי הוראות קבע קיימות ברווחית אינם משתנים כאן.</p>
      <p className="mt-2 text-sm">עריכת סטטוס ותוקף המנוי נמצאת ב״פעולות מסלול, תשלום ומחיקה״ ברשימת המתאמנים.</p>
      <p className="mt-3 text-sm">שיוך משפחתי אינו משנה מסלול, תוקף או תשלום קיים. ראש משפחה עם בני משפחה אינו ניתן להעברה לפני החלפת משלם.</p>
      {error && <p role="alert" className="mt-3 text-rose-300">{error}</p>}
      <div className="mt-5 flex gap-3"><button type="submit" disabled={imageProcessing || saving} className="rounded-xl bg-amber-400 px-5 py-3 font-bold text-black disabled:opacity-50">{saving ? 'שומר…' : 'שמור פרטים'}</button><button type="button" disabled={saving} onClick={onClose} className="rounded-xl border px-5 py-3">ביטול</button></div>
    </form>
  </div>;
}
