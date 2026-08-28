import React, { useEffect, useMemo, useState } from 'react';
import { Archive, CalendarCheck, Check, Send, X } from 'lucide-react';
import { TrainingSession } from '../types';

interface PublishDestinationDialogProps {
  open: boolean;
  title: string;
  sessions: TrainingSession[];
  onClose: () => void;
  onSaveToLibrary: () => void;
  onAssignToSession: (sessionId: string) => void;
  onPublishDirect?: () => void;
  directPublishLabel?: string;
  directPublishDescription?: string;
}

export const PublishDestinationDialog: React.FC<PublishDestinationDialogProps> = ({
  open,
  title,
  sessions,
  onClose,
  onSaveToLibrary,
  onAssignToSession,
  onPublishDirect,
  directPublishLabel = 'פרסום מיידי',
  directPublishDescription = 'התוכנית תופיע מיד באזור התוכנית הפעילה'
}) => {
  const [mode, setMode] = useState<'CHOICE' | 'CALENDAR'>('CHOICE');
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const sortedSessions = useMemo(() => [...sessions].sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`)), [sessions]);

  useEffect(() => {
    if (!open) return;
    setMode('CHOICE');
    setSelectedSessionId('');
  }, [open]);

  if (!open) return null;

  return <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-5" dir="rtl" role="dialog" aria-modal="true" aria-label="בחירת יעד לפרסום">
    <section className="max-h-[88vh] w-full overflow-y-auto rounded-t-3xl border border-zinc-700 bg-zinc-950 p-5 text-white shadow-2xl sm:max-w-xl sm:rounded-3xl">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div><span className="text-[10px] font-black text-amber-300">פרסום תוכנית</span><h2 className="mt-1 text-xl font-black">{title}</h2><p className="mt-1 text-xs leading-5 text-zinc-400">בחרו מה לעשות עם התוכנית המוכנה.</p></div>
        <button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-zinc-800 text-zinc-200" aria-label="סגירה"><X size={19} /></button>
      </header>

      {mode === 'CHOICE' ? <div className={`grid gap-3 ${onPublishDirect ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
        {onPublishDirect && <button type="button" onClick={onPublishDirect} className="flex min-h-28 items-center gap-3 rounded-2xl border border-sky-400/40 bg-sky-400/10 p-4 text-right transition hover:bg-sky-400/20">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-sky-400 text-zinc-950"><Send size={22} /></span><span><strong className="block text-sm text-white">{directPublishLabel}</strong><small className="mt-1 block text-[11px] leading-5 text-zinc-300">{directPublishDescription}</small></span>
        </button>}
        <button type="button" onClick={() => setMode('CALENDAR')} className="flex min-h-28 items-center gap-3 rounded-2xl border border-amber-400/40 bg-amber-400/10 p-4 text-right transition hover:bg-amber-400/20">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-400 text-zinc-950"><CalendarCheck size={22} /></span><span><strong className="block text-sm text-white">שיבוץ לאימון ביומן</strong><small className="mt-1 block text-[11px] leading-5 text-zinc-300">בחירת אימון קיים ושיבוץ התוכנית אליו</small></span>
        </button>
        <button type="button" onClick={onSaveToLibrary} className="flex min-h-28 items-center gap-3 rounded-2xl border border-emerald-400/35 bg-emerald-400/10 p-4 text-right transition hover:bg-emerald-400/20">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-400 text-zinc-950"><Archive size={22} /></span><span><strong className="block text-sm text-white">שמירה במאגר בלבד</strong><small className="mt-1 block text-[11px] leading-5 text-zinc-300">התוכנית תהיה זמינה לשימוש ושיבוץ בהמשך</small></span>
        </button>
      </div> : <div className="space-y-4">
        <button type="button" onClick={() => setMode('CHOICE')} className="text-xs font-black text-amber-300">→ חזרה לבחירת יעד</button>
        {sortedSessions.length === 0 ? <p className="rounded-2xl border border-dashed border-zinc-700 p-6 text-center text-sm text-zinc-400">אין כרגע אימונים מתאימים ביומן. אפשר לשמור את התוכנית במאגר ולשבץ אותה מאוחר יותר.</p> : <div className="space-y-2">
          {sortedSessions.map(session => <label key={session.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${selectedSessionId === session.id ? 'border-amber-400 bg-amber-400/10' : 'border-zinc-700 bg-zinc-900'}`}>
            <input type="radio" name="publish-session" value={session.id} checked={selectedSessionId === session.id} onChange={() => setSelectedSessionId(session.id)} className="accent-amber-400" />
            <span className="min-w-0 flex-1"><strong className="block truncate text-sm text-white">{session.title}</strong><small className="mt-0.5 block text-[11px] text-zinc-400">{session.date} · {session.time} · {session.registeredUsers.length} נרשמים</small></span>
          </label>)}
        </div>}
        <button type="button" disabled={!selectedSessionId} onClick={() => onAssignToSession(selectedSessionId)} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-400 text-sm font-black text-zinc-950 disabled:opacity-40"><Check size={18} /> אשר ושבץ ביומן</button>
      </div>}
    </section>
  </div>;
};
