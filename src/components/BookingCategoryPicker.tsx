import React from 'react';
import { BookingCategory, BookingFilter } from '../data/traineeBookingFilter';

const labels: Record<BookingCategory, string> = { GROUP: 'קבוצתיים', PERSONAL: 'אישיים / זוגיים', OPEN_GYM: 'Open Gym' };
interface Props {
  primary?: BookingCategory;
  additional: BookingCategory[];
  filter: BookingFilter;
  allClub: boolean;
  expanded: boolean;
  onExpand: () => void;
  onChoose: (filter: BookingFilter, allClub: boolean) => void;
}
export function BookingCategoryPicker({ primary, additional, filter, allClub, expanded, onExpand, onChoose }: Props) {
  const buttonClass = 'min-h-11 rounded-xl border border-slate-600 px-4 py-3 text-sm font-bold text-slate-100 aria-pressed:border-amber-400 aria-pressed:bg-amber-400 aria-pressed:text-black';
  return <section dir="rtl" aria-label="בחירת אימונים לפי המנוי" className="space-y-3 rounded-2xl bg-slate-900 p-4 text-slate-100">
    <p className="text-sm">ברירת המחדל היא אימוני המסלול הראשי שלך, בהתאם למגבלות ההרשמה.</p>
    <div className="flex flex-wrap gap-2">
      <button type="button" className={buttonClass} aria-pressed={filter === 'PRIMARY' && !allClub} onClick={() => onChoose('PRIMARY', false)}>המסלול הראשי — {primary ? labels[primary] : 'האימונים שמתאימים לי'}</button>
      {additional.length > 0 && <button type="button" className={buttonClass} aria-expanded={expanded} aria-controls="additional-booking-categories" onClick={onExpand}>הצג אימונים נוספים</button>}
      <button type="button" className={buttonClass} aria-pressed={allClub} onClick={() => onChoose('ALL', true)}>הצג את כל אימוני המועדון</button>
    </div>
    {expanded && additional.length > 0 && <div id="additional-booking-categories" className="flex flex-wrap gap-2">
      {additional.map(category => <button key={category} type="button" className={buttonClass} aria-pressed={filter === category && !allClub} onClick={() => onChoose(category, false)}>הצג {labels[category]}</button>)}
      <button type="button" className={buttonClass} aria-pressed={filter === 'ALL' && !allClub} onClick={() => onChoose('ALL', false)}>כל האימונים במסלולים שלי</button>
    </div>}
    {allClub && <p className="text-sm text-amber-200">מוצגים גם אימונים שלא כלולים במנוי שלך. ההרשמה עדיין כפופה למסלול ולמגבלות האימון.</p>}
  </section>;
}
