import React from 'react';

export function WorkoutMembershipRequired({ onCheckout }: { onCheckout: () => void }) {
  return <section role="alert" dir="rtl" className="rounded-2xl border border-amber-500 bg-slate-950 p-6 text-white space-y-3">
    <h3 className="text-lg font-bold text-amber-300">נדרש מנוי כניסה בתוקף לצפייה בתוכנית האימון</h3>
    <p>רכישת תוכנית אימון אינה כוללת כניסה למועדון. כדי לצפות בתוכנית יש לרכוש או לחדש מנוי Open Gym, או מנוי קבוצתי הכולל Open Gym.</p>
    <p className="text-sm text-slate-300">התוכנית שרכשת נשמרת; אין צורך לרכוש אותה שוב.</p>
    <button type="button" onClick={onCheckout} className="min-h-11 rounded-xl bg-amber-400 px-5 py-2 font-bold text-slate-950">לבחירת מנוי ותשלום</button>
  </section>;
}
