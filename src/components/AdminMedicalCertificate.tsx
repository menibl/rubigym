import React, { useEffect, useState } from 'react';
import type { HealthDeclarationRecord, User } from '../types';
import { manageMedicalCertificate } from '../data/clubServer';
import { medicalDocument } from '../../shared/medical-certificate.js';

export function AdminMedicalCertificate({ user, record }: { user: User; record: HealthDeclarationRecord }) {
  const [current, setCurrent] = useState(record);
  const [busy, setBusy] = useState(false), [reviewed, setReviewed] = useState(false);
  const [message, setMessage] = useState(''), [error, setError] = useState('');
  useEffect(() => { setCurrent(record); setReviewed(false); }, [record]);
  const document = medicalDocument(current);
  const perform = async (action: 'upload' | 'approve', file?: File) => {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      let attachment: { fileName: string; dataUrl: string } | undefined;
      if (file) {
        if (file.size > 5 * 1024 * 1024 || !['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('יש לבחור PDF או תמונה בגודל עד 5MB.');
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader(); reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('קריאת הקובץ נכשלה.'));
          reader.onerror = () => reject(new Error('קריאת הקובץ נכשלה.')); reader.readAsDataURL(file);
        });
        attachment = { fileName: file.name, dataUrl };
      }
      const updated = await manageMedicalCertificate({ action, userId: user.id, recordId: record.id,
        expectedDocumentId: document?.id || '', document: attachment });
      const saved = updated.healthDeclarationHistory?.find(item => item.id === record.id);
      if (saved) setCurrent(saved);
      setReviewed(false);
      setMessage(action === 'upload' ? 'האישור נשמר וממתין לבדיקה. ההצהרה והחתימה המקוריות לא שונו.' : 'האישור הרפואי אושר. תאריך ההצהרה והתוקף המקורי לא השתנו.');
    } catch (err) { setError(err instanceof Error ? err.message : 'הפעולה נכשלה.'); }
    finally { setBusy(false); }
  };
  return <div className="space-y-2 rounded-xl bg-slate-950 p-3 text-xs text-slate-200" aria-label={`אישור רופא עבור ${user.name}`}>
    {document ? <a href={document.dataUrl} download={document.fileName} className="block font-bold text-sky-300 underline">צפייה באישור: {document.fileName}</a> : <p>טרם הועלה אישור רופא.</p>}
    <p>{current.medicalCertificateApproved ? 'האישור הרפואי אושר' : 'ממתין לאישור מנהל — הרשמה לאימונים חסומה'}</p>
    <label className="block">העלאת אישור רופא — {user.name}
      <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={busy} className="block max-w-64"
        onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void perform('upload', file); }} />
    </label>
    {document && !current.medicalCertificateApproved && <>
      <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={reviewed} disabled={busy} onChange={event => setReviewed(event.target.checked)} />בדקתי את האישור הרפואי המצורף</label>
      <button type="button" disabled={busy || !reviewed} onClick={() => void perform('approve')} className="min-h-11 rounded-lg bg-amber-500 px-3 font-bold text-slate-950 disabled:opacity-50">אישור מנהל לאישור הרופא</button>
    </>}
    {busy && <p role="status">שומר…</p>}{message && <p role="status">{message}</p>}{error && <p role="alert" className="text-rose-300">{error}</p>}
    {!!current.medicalCertificateAudit?.length && <details><summary className="cursor-pointer">תיעוד העלאות ואישורים</summary>{current.medicalCertificateAudit.map((event, index) => <p key={index}>{event.action === 'UPLOAD' ? 'העלאה' : 'אישור'} · {new Date(event.at).toLocaleString('he-IL')} · מנהל: {event.by}</p>)}</details>}
    <p>החלפת קובץ דורשת אישור מחדש. פעולה זו אינה משנה תשובות, חתימה או תוקף הצהרה.</p>
  </div>;
}
