import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { User, UserRole } from '../types';
import { createCoachException, saveHistoricalCoachArrival } from '../data/clubServer';
import { clubDate } from '../../shared/membership-calendar.js';

export function CoachExceptionArrivalPanel({ users }: { users: User[] }) {
  const [traineeId, setTraineeId] = useState('');
  const [reason, setReason] = useState('');
  const [qr, setQr] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [now, setNow] = useState(Date.now());
  const [type, setType] = useState<'SOLO' | 'DUO'>('SOLO');
  const [date, setDate] = useState(clubDate(new Date()));
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [recorded, setRecorded] = useState(false);
  const eventId = useRef('');
  const busyRef = useRef(false);
  const trainee = users.find(u => u.id === traineeId);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const reset = () => { setQr(''); setExpiresAt(''); setConfirmed(false); setMessage(''); setError(''); setRecorded(false); eventId.current = ''; };
  const create = async () => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(''); setQr('');
    try {
      const result = await createCoachException({ traineeId, reason });
      setQr(await QRCode.toDataURL(result.code, { width: 360, margin: 3, errorCorrectionLevel: 'M' }));
      setExpiresAt(result.expiresAt); setNow(Date.now());
    } catch (e) { setError(e.message); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const record = async () => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    if (!eventId.current) eventId.current = crypto.randomUUID();
    try {
      const result = await saveHistoricalCoachArrival({ traineeId, trainingType: type, date, reason, eventId: eventId.current, confirmDebit: confirmed });
      setMessage(result.message); setRecorded(true); setConfirmed(false);
    } catch (e) { setError(e.message); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const validQr = qr && Date.parse(expiresAt) > now;
  return <details className="m-3 rounded-2xl border border-amber-500/50 bg-slate-900 p-4 text-right text-slate-100" dir="rtl">
    <summary className="min-h-11 cursor-pointer text-lg font-bold">אישור חריג — אישי / זוגי וברקוד מאמן</summary>
    <div className="mt-4 space-y-4" aria-busy={busy}>
      <p className="text-sm text-slate-300">אישור אישי וחד־פעמי למתאמן שנבחר, גם כאשר קיים ביומן אימון שאינו מתאים. אינו מחליף את קוד המועדון ואינו מאפשר Open Gym. רק יתרה קיימת תנוכה.</p>
      <label className="block">מתאמן<select disabled={busy} value={traineeId} onChange={e => { reset(); setTraineeId(e.target.value); }} className="mt-2 min-h-12 w-full rounded-xl bg-slate-800 p-3 text-white"><option value="">בחירת מתאמן מהמאגר</option>{users.filter(u => u.role === UserRole.TRAINEE).slice().sort((a, b) => a.name.localeCompare(b.name, 'he')).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
      {trainee && <p className="text-sm text-slate-300">יתרה במערכת — אישי: {trainee.personalTrainingRemaining ?? 0}; זוגי: {trainee.duoTrainingRemaining ?? 0}. השרת בודק את היתרה מחדש לפני הניכוי.</p>}
      <label className="block">סיבת האישור<textarea disabled={busy} maxLength={500} value={reason} onChange={e => { reset(); setReason(e.target.value); }} className="mt-2 min-h-20 w-full rounded-xl bg-slate-800 p-3 text-white" /></label>
      <button type="button" disabled={busy || !traineeId || !reason.trim()} onClick={() => void create()} className="min-h-12 w-full rounded-xl bg-amber-400 p-3 font-bold text-black disabled:opacity-50">הצגת ברקוד אישור למתאמן — 10 דקות</button>
      {validQr && <div className="space-y-2 text-center"><img src={qr} alt={`ברקוד אישור חריג חד־פעמי עבור ${trainee?.name}`} className="mx-auto w-full max-w-sm rounded-xl bg-white p-2" /><p>מיועד ל{trainee?.name} בלבד · בתוקף עוד {Math.ceil((Date.parse(expiresAt) - now) / 60000)} דקות</p><p className="text-sm text-slate-300">המתאמן סורק בסורק הרגיל, בוחר אישי או זוגי ומאשר ניכוי. מנוי והצהרת בריאות תקפים נדרשים לכניסה נוכחית.</p></div>}
      {qr && !validQr && <p role="status">האישור פג תוקף. יש להפיק ברקוד חדש.</p>}
      <details className="rounded-xl border border-slate-600 p-3"><summary className="min-h-11 cursor-pointer font-bold">תיעוד אימון שכבר בוצע — ללא סריקת המתאמן</summary><div className="mt-3 space-y-3">
        <p className="text-sm text-slate-300">לתיקון יתרה על אימון שכבר בוצע בלבד, גם אם טרם הושלם הרישום. לא מאשר כניסה נוכחית ולא יוצר מתאמן חדש. תישמר סיבת התיקון וזהות המאמן.</p>
        <label className="block">כרטיסייה לניכוי<select disabled={busy} value={type} onChange={e => { reset(); setType(e.target.value as 'SOLO' | 'DUO'); }} className="mt-1 min-h-12 w-full rounded-xl bg-slate-800 p-3"><option value="SOLO">אימון אישי</option><option value="DUO">אימון זוגי — קרדיט אחד</option></select></label>
        <label className="block">תאריך האימון<input disabled={busy} type="date" value={date} max={clubDate(new Date())} onChange={e => { reset(); setDate(e.target.value); }} className="mt-1 min-h-12 w-full rounded-xl bg-slate-800 p-3" /></label>
        {!recorded && <><label className="flex min-h-12 items-center gap-3"><input type="checkbox" disabled={busy} checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />אני מאשר/ת שהאימון בוצע ושיש לנכות קרדיט אחד מהכרטיסייה שנבחרה</label><button type="button" disabled={busy || !confirmed || !traineeId || !reason.trim()} onClick={() => void record()} className="min-h-12 w-full rounded-xl bg-amber-400 p-3 font-bold text-black disabled:opacity-50">תיעוד האימון וניכוי קרדיט אחד</button></>}
        {recorded && <button type="button" onClick={reset} className="min-h-12 w-full rounded-xl border border-slate-500 p-3">פתיחת תיעוד נוסף</button>}
      </div></details>
      {error && <p role="alert" className="text-rose-300">{error}</p>}
      {message && <p role="status" className="text-emerald-300">{message}</p>}
    </div>
  </details>;
}
