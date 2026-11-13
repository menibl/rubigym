import React, { useEffect, useRef, useState } from 'react';
import { MEMBERSHIP_TYPE_LABELS, type MembershipPlanConfig, type User } from '../types';
import { activeDebtTrainees, filterDebtTrainees } from '../data/unpaidTrainees';

export function UnpaidTraineesList({ users, plans, onClose, onOpenUser }: {
  users: User[]; plans: MembershipPlanConfig[]; onClose: () => void; onOpenUser: (id: string) => void;
}) {
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => { searchRef.current?.focus(); }, []);
  const count = activeDebtTrainees(users).length;
  const shown = filterDebtTrainees(users, search, users);
  return <section id="finance-unpaid-list" aria-labelledby="finance-unpaid-title" className="mb-6 space-y-4 rounded-2xl border border-rose-400/40 bg-slate-950 p-4 text-slate-100 sm:p-6" dir="rtl"
    onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); onClose(); } }}>
    <header className="flex flex-wrap items-center justify-between gap-3">
      <h3 id="finance-unpaid-title" className="text-lg font-bold">מתאמנים במצב חוב פעיל ({count})</h3>
      <button type="button" onClick={onClose} className="min-h-11 rounded-xl border border-slate-500 px-4 text-sm font-bold">סגירת הרשימה</button>
    </header>
    <p className="text-sm text-slate-300">הרשימה לפי סטטוס החוב במערכת, ותואמת למספר בכרטיס הסיכום. סימון חוב אינו הוכחה שחיוב נדחה ברווחית; יש לבדוק אישורים ותשלומים בפרטי המתאמן.</p>
    <label htmlFor="finance-unpaid-search" className="block text-sm">חיפוש לפי שם, טלפון, דוא״ל או משלם משפחתי
      <input ref={searchRef} id="finance-unpaid-search" type="search" value={search} onChange={event => setSearch(event.target.value)}
        className="mt-2 min-h-11 w-full rounded-xl border border-slate-500 bg-slate-900 p-3 text-white" />
    </label>
    <p role="status" className="text-sm text-slate-300">מציג {shown.length} מתוך {count} מתאמנים</p>
    {!shown.length ? <p className="rounded-xl border border-slate-600 p-4">{count ? 'לא נמצאו מתאמנים התואמים לחיפוש.' : 'אין מתאמנים במצב חוב פעיל.'}</p> :
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{shown.map(user => {
        const payer = users.find(candidate => candidate.id === user.familyPayerId);
        return <li key={user.id} className="min-w-0 space-y-2 rounded-xl border border-slate-600 bg-slate-900 p-4 text-sm">
          <h4 className="break-words text-base font-bold text-white">{user.name || 'ללא שם מתועד'}</h4>
          <p>טלפון: <span dir="ltr">{user.phone || 'לא תועד'}</span></p>
          {user.email && <p className="break-all">דוא״ל: <span dir="ltr">{user.email}</span></p>}
          <p>מסלול: {plans.find(plan => plan.id === user.membershipType)?.label || MEMBERSHIP_TYPE_LABELS[user.membershipType!]?.label || user.membershipType || 'לא נבחר מסלול'}</p>
          <p>תוקף מנוי מתועד: <span dir="ltr">{user.membershipExpiry || 'לא הוגדר'}</span></p>
          {(payer || user.isFamilyPayer || user.familyName) && <p>משפחה: {user.familyName || 'משויכת'} · משלם: {user.isFamilyPayer ? user.name : payer?.name || 'לא תועד'}</p>}
          {user.offlinePaymentApproved && <p className="text-amber-200">קיים גם אישור מנהל ידני — יש לבדוק את סטטוס החוב.</p>}
          {(user.registrationPaymentPending || user.familyPaymentPending) && <p className="text-amber-200">ממתין להשלמת תשלום</p>}
          <button type="button" onClick={() => onOpenUser(user.id)} aria-label={`פתיחת פרטי המתאמן ${user.name}`} className="min-h-11 w-full rounded-xl border border-amber-400/60 px-3 font-bold text-amber-200 hover:bg-slate-800">פרטי המתאמן</button>
        </li>;
      })}</ul>}
  </section>;
}
