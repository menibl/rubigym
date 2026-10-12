import React, { useEffect, useRef } from 'react';
import { TrainingSession } from '../types';

export const WeeklyBookingPopup = ({ sessions, onClose, onRegister }: {
  sessions: TrainingSession[]; onClose: () => void; onRegister: (session: TrainingSession) => void;
}) => {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-3" dir="rtl">
    <div ref={panel} role="dialog" aria-modal="true" aria-labelledby="weekly-bookings-title"
      className="max-h-[85dvh] w-full max-w-xl overflow-y-auto rounded-2xl border border-amber-400/40 bg-slate-950 p-5 text-white shadow-2xl"
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); onClose(); }
        if (event.key === 'Tab') {
          const buttons = [...(panel.current?.querySelectorAll<HTMLButtonElement>('button') || [])];
          const first = buttons[0], last = buttons.at(-1);
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div><h2 id="weekly-bookings-title" className="text-xl font-bold">האימונים הבאים שאפשר להירשם אליהם השבוע</h2><p className="mt-2 text-sm text-slate-300">עד יום שישי, לפי המסלול וההתאמה האישית שלך.</p></div>
        <button type="button" onClick={onClose} aria-label="סגירת חלון האימונים" className="min-h-11 min-w-11 rounded-lg border border-slate-600 text-xl">×</button>
      </div>
      <ul className="space-y-3">{sessions.map(session => <li key={session.id} className="rounded-xl border border-slate-700 bg-slate-900 p-3">
        <strong className="block text-base">{session.title}</strong>
        <p className="my-2 text-sm text-slate-300">{new Date(`${session.date}T12:00:00Z`).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric', timeZone: 'Asia/Jerusalem' })} · <span dir="ltr">{session.time}</span></p>
        <button type="button" onClick={() => onRegister(session)} aria-label={`הרשמה ל${session.title} בתאריך ${session.date} בשעה ${session.time}`}
          className="min-h-11 w-full rounded-lg bg-amber-300 px-4 py-2 font-bold text-slate-950">{session.registeredUsers.length >= session.maxParticipants ? 'הרשמה לרשימת המתנה' : 'הרשמה לאימון'}</button>
      </li>)}</ul>
      <button type="button" onClick={onClose} className="mt-4 min-h-11 w-full rounded-lg border border-slate-500 p-2 font-bold">סגירה והמשך לאפליקציה</button>
    </div>
  </div>;
};
