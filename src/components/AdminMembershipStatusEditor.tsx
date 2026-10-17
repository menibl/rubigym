import React, { useState } from 'react';
import { MembershipStatus, type User } from '../types';

export function updateMembershipStatusAndExpiry(user: User, status: MembershipStatus, expiry: string): User {
  if (![MembershipStatus.ACTIVE, MembershipStatus.DEBT, MembershipStatus.EXPIRED].includes(status)) throw new Error('סטטוס המנוי אינו תקין.');
  if (expiry && (!/^\d{4}-\d{2}-\d{2}$/.test(expiry) || !Number.isFinite(Date.parse(expiry))
    || new Date(expiry).toISOString().slice(0, 10) !== expiry)) throw new Error('יש לבחור תאריך תוקף תקין.');
  return { ...user, membershipStatus: status,
    ...(expiry !== (user.membershipExpiry || '') ? { membershipExpiry: expiry || undefined, membershipExpiryManualOverride: true } : {}) };
}

export function AdminMembershipStatusEditor({ user, onSave }: { user: User; onSave: (user: User) => void }) {
  const [status, setStatus] = useState(user.membershipStatus);
  const [expiry, setExpiry] = useState(user.membershipExpiry || '');
  const [error, setError] = useState('');
  const changed = status !== user.membershipStatus || expiry !== (user.membershipExpiry || '');
  return <form className="w-full space-y-2 text-right" onSubmit={event => {
    event.preventDefault();
    try { onSave(updateMembershipStatusAndExpiry(user, status, expiry)); setError(''); }
    catch (err) { setError(err instanceof Error ? err.message : 'לא ניתן לשמור את המנוי.'); }
  }}>
    <label className="block text-sm">סטטוס המנוי
      <select aria-label={`סטטוס המנוי של ${user.name}`} value={status} onChange={event => setStatus(event.target.value as MembershipStatus)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-500 bg-slate-950 p-2 text-slate-100">
        <option value={MembershipStatus.ACTIVE}>סמן כפעיל</option>
        <option value={MembershipStatus.DEBT}>סמן בחוב כספי</option>
        <option value={MembershipStatus.EXPIRED}>סמן כפג תוקף</option>
      </select>
    </label>
    <label className="block text-sm">תוקף מנוי
      <input type="date" aria-label={`תוקף המנוי של ${user.name}`} aria-describedby={`expiry-help-${user.id}`} value={expiry} onChange={event => setExpiry(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-500 bg-slate-950 p-2 text-slate-100" />
    </label>
    <p id={`expiry-help-${user.id}`} className="text-xs text-slate-300">במנוי קלנדרי התוקף מסתיים בתחילת התאריך המוצג. שינוי ידני נשמר עד הרכישה או החידוש הבא ואינו משנה תשלום.</p>
    {!expiry && <p className="text-xs text-amber-200">ללא תאריך תוקף, סימון כפעיל בלבד אינו מאפשר כניסה למועדון.</p>}
    {error && <p role="alert" className="text-sm text-rose-200">{error}</p>}
    <button type="submit" disabled={!changed} className="min-h-11 w-full rounded-lg bg-amber-400 p-2 font-bold text-black disabled:opacity-50">שמור סטטוס ותוקף</button>
  </form>;
}
