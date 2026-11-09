import React from 'react';
import type { User } from '../types';

type DateProfile = Pick<User, 'registrationVerifiedAt' | 'registrationCompletedAt' | 'healthDeclarationSigned'
  | 'healthDeclarationDate' | 'healthDeclarationRequiresMedicalCertificate' | 'healthDeclarationMedicalCertificateApproved'>;

const parsed = (value?: string) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)) return undefined;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return undefined;
  // Date-only records must not silently roll an invalid date into next month.
  if (value.length === 10 && date.toISOString().slice(0, 10) !== value) return undefined;
  return date;
};
const label = (date: Date) => date.toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' });

export function TraineeDates({ user, now = new Date() }: { user: DateProfile; now?: Date }) {
  const joined = [parsed(user.registrationVerifiedAt), parsed(user.registrationCompletedAt)]
    .filter((date): date is Date => Boolean(date)).sort((a, b) => a.getTime() - b.getTime())[0];
  const signed = user.healthDeclarationSigned ? parsed(user.healthDeclarationDate) : undefined;
  const expires = signed ? new Date(signed) : undefined;
  // Match the existing server check-in and personal-booking annual validity.
  if (expires) expires.setUTCFullYear(expires.getUTCFullYear() + 1);
  const expired = expires && now.getTime() > expires.getTime();
  const pendingMedical = user.healthDeclarationRequiresMedicalCertificate && !user.healthDeclarationMedicalCertificateApproved;
  return <dl className="mt-2 space-y-1 text-xs leading-relaxed text-slate-300" aria-label="תאריכי הצטרפות והצהרת בריאות">
    <div><dt className="inline">תאריך הצטרפות: </dt><dd className="inline">{joined
      ? <time dateTime={joined.toISOString()}>{label(joined)}</time> : 'לא תועד'}</dd></div>
    <div><dt className="inline">תוקף הצהרת בריאות: </dt><dd className={`inline ${expired || !expires ? 'font-bold text-rose-300' : ''}`}>{expires
      ? <><time dateTime={expires.toISOString()}>{label(expires)}</time>{expired ? ' — פג תוקף, נדרש חידוש' : ''}</>
      : user.healthDeclarationSigned ? 'תאריך חתימה חסר או לא תקין' : 'לא נחתמה'}
      {expires && pendingMedical ? ' — ממתין לאישור רפואי' : ''}</dd></div>
  </dl>;
}
