import React, { useEffect, useRef, useState } from 'react';
import { Gender, User } from '../types';
import { assignTraineeFamily } from '../../shared/admin-trainees.js';

export function AdminTraineeEditor({ user, users, onSave, onClose }: {
  user: User; users: User[]; onSave: (users: User[]) => void; onClose: () => void;
}) {
  const [draft, setDraft] = useState({ name: user.name, username: user.username || '', email: user.email || '', phone: user.phone || '', gender: user.gender || Gender.ALL, birthDate: user.birthDate || '', membershipExpiry: user.membershipExpiry || '', payerId: user.familyPayerId || (user.isFamilyPayer ? user.id : '') });
  const [error, setError] = useState('');
  const dialogRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLInputElement>('input')?.focus();
    return () => previousFocus?.focus();
  }, []);
  const save = (event: React.FormEvent) => {
    event.preventDefault();
    try {
      if (!draft.name.trim()) throw new Error('יש להזין שם מתאמן.');
      const normalizedPhone = draft.phone.replace(/\D/g, '').replace(/^972/, '0');
      if (draft.phone && !/^05\d{8}$/.test(normalizedPhone)) throw new Error('יש להזין מספר נייד ישראלי תקין.');
      if (users.some(member => member.id !== user.id && ((draft.username && member.username?.toLowerCase() === draft.username.trim().toLowerCase()) || (normalizedPhone && member.phone?.replace(/\D/g, '').replace(/^972/, '0') === normalizedPhone)))) throw new Error('שם המשתמש או הטלפון שייכים למשתמש אחר.');
      const today = new Date();
      const birth = draft.birthDate ? new Date(`${draft.birthDate}T00:00:00`) : null;
      if (birth && (!Number.isFinite(birth.getTime()) || birth > today)) throw new Error('תאריך הלידה אינו תקין.');
      const age = birth ? today.getFullYear() - birth.getFullYear() - (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate()) ? 1 : 0) : user.age;
      const updated = users.map(member => member.id === user.id ? { ...member, name: draft.name.trim(), username: draft.username.trim(), email: draft.email.trim().toLowerCase(), phone: normalizedPhone, gender: draft.gender, birthDate: draft.birthDate || undefined, age } : member);
      const linked = assignTraineeFamily(updated, user.id, draft.payerId);
      const edited = linked.find(member => member.id === user.id);
      if (draft.email && linked.some(member => member.id !== user.id && member.email?.toLowerCase() === draft.email.trim().toLowerCase() && (!edited.familyId || member.familyId !== edited.familyId))) throw new Error('כתובת הדוא״ל שייכת למשתמש מחוץ למשפחה.');
      onSave(linked.map(member => member.id === user.id && draft.membershipExpiry !== (user.membershipExpiry || '')
        ? { ...member, membershipExpiry: draft.membershipExpiry || undefined, membershipExpiryManualOverride: true } : member));
      onClose();
    } catch (err) { setError(err instanceof Error ? err.message : 'לא ניתן לשמור.'); }
  };
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-3" dir="rtl">
    <form ref={dialogRef} onSubmit={save} onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.key !== 'Tab') return;
      const controls = dialogRef.current?.querySelectorAll<HTMLElement>('input, select, button');
      if (!controls?.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }} role="dialog" aria-modal="true" aria-labelledby="trainee-edit-title" className="trainee-admin-editor mx-auto my-6 max-w-xl rounded-2xl border p-5">
      <h3 id="trainee-edit-title" className="text-xl font-bold">עריכת פרטי {user.name}</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {(['name', 'username', 'email', 'phone', 'birthDate'] as const).map(key => <label key={key} className="text-sm">{{ name: 'שם מלא', username: 'שם משתמש', email: 'דוא״ל', phone: 'טלפון', birthDate: 'תאריך לידה' }[key]}<input type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : key === 'birthDate' ? 'date' : 'text'} value={draft[key]} onChange={event => setDraft({ ...draft, [key]: event.target.value })} className="mt-1 w-full rounded-xl border p-3" /></label>)}
        <label>מין<select value={draft.gender} onChange={event => setDraft({ ...draft, gender: event.target.value as Gender })} className="mt-1 w-full rounded-xl border p-3"><option value={Gender.ALL}>לא הוגדר</option><option value={Gender.MALE}>זכר</option><option value={Gender.FEMALE}>נקבה</option></select></label>
        <label className="sm:col-span-2">שיוך למשפחה — הגורם המשלם<select value={draft.payerId} onChange={event => setDraft({ ...draft, payerId: event.target.value })} className="mt-1 w-full rounded-xl border p-3"><option value="">ללא משפחה — משלם עצמאי</option>{users.filter(member => member.isFamilyPayer && member.familyId).map(payer => <option key={payer.id} value={payer.id}>{payer.familyName || 'משפחה'} — {payer.name}</option>)}</select></label>
      </div>
      <label className="mt-4 block">תוקף מנוי<input type="date" value={draft.membershipExpiry} onChange={event => setDraft({ ...draft, membershipExpiry: event.target.value })} className="mt-1 w-full rounded-xl border p-3" /></label>
      <p className="mt-2 text-sm">במנוי קלנדרי התוקף מסתיים בתחילת התאריך המוצג. שינוי ידני נשמר עד הרכישה או החידוש הבא ואינו משנה תשלום.</p>
      <p className="mt-3 text-sm">שיוך משפחתי אינו משנה מסלול, תוקף או תשלום קיים. ראש משפחה עם בני משפחה אינו ניתן להעברה לפני החלפת משלם.</p>
      {error && <p role="alert" className="mt-3 text-rose-300">{error}</p>}
      <div className="mt-5 flex gap-3"><button type="submit" className="rounded-xl bg-amber-400 px-5 py-3 font-bold text-black">שמור פרטים</button><button type="button" onClick={onClose} className="rounded-xl border px-5 py-3">ביטול</button></div>
    </form>
  </div>;
}
