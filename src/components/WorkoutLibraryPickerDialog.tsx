import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Check, Search, UserRound, UsersRound, X } from 'lucide-react';
import { GroupWorkoutProgram, User, WorkoutPlan } from '../types';

export type WorkoutLibraryKind = 'PERSONAL' | 'GROUP';

interface WorkoutLibraryPickerDialogProps {
  open: boolean;
  personalPlans: WorkoutPlan[];
  groupPrograms: GroupWorkoutProgram[];
  users?: User[];
  fixedKind?: WorkoutLibraryKind;
  selectedId?: string;
  title?: string;
  onClose: () => void;
  onSelect: (kind: WorkoutLibraryKind, id: string) => void;
}

const personalCreatedAt = (plan: WorkoutPlan) => plan.libraryCreatedAt || `${plan.lastUpdated}T00:00:00`;
const groupCreatedAt = (program: GroupWorkoutProgram) => program.createdAt || program.updatedAt;
const isoDate = (value: string) => value.slice(0, 10);
const displayDate = (value: string) => {
  const date = new Date(value.includes('T') ? value : `${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('he-IL');
};

export const WorkoutLibraryPickerDialog: React.FC<WorkoutLibraryPickerDialogProps> = ({
  open,
  personalPlans,
  groupPrograms,
  users = [],
  fixedKind,
  selectedId,
  title = 'בחירת תוכנית מהמאגר',
  onClose,
  onSelect
}) => {
  const [kind, setKind] = useState<WorkoutLibraryKind | 'ALL'>(fixedKind || 'ALL');
  const [query, setQuery] = useState('');
  const [createdDate, setCreatedDate] = useState('');
  const [choice, setChoice] = useState<{ kind: WorkoutLibraryKind; id: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    setKind(fixedKind || 'ALL');
    setQuery('');
    setCreatedDate('');
    const selectedKind = personalPlans.some(plan => plan.id === selectedId) ? 'PERSONAL'
      : groupPrograms.some(program => program.id === selectedId) ? 'GROUP'
        : fixedKind;
    setChoice(selectedId && selectedKind ? { kind: selectedKind, id: selectedId } : null);
  }, [open, fixedKind, selectedId, personalPlans, groupPrograms]);

  const entries = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('he-IL');
    const personal = personalPlans
      .filter(plan => !plan.sessionId && plan.exercises.length > 0 && plan.libraryEntry !== false)
      .map(plan => ({
        kind: 'PERSONAL' as const,
        id: plan.id,
        title: plan.title || 'תוכנית אישית',
        subtitle: `${users.find(user => user.id === plan.traineeId)?.name || 'תבנית כללית'} · ${plan.exercises.length} תרגילים`,
        createdAt: personalCreatedAt(plan)
      }));
    const group = groupPrograms
      .filter(program => !program.sessionId && program.libraryEntry !== false && program.status === 'PUBLISHED')
      .map(program => ({
        kind: 'GROUP' as const,
        id: program.id,
        title: program.title || 'תוכנית קבוצתית',
        subtitle: `${program.groupName} · ${program.mode === 'ROTATING_GROUPS' ? (program.stations || []).reduce((sum, station) => sum + station.exercises.length, 0) : program.exercises.length} תרגילים`,
        createdAt: groupCreatedAt(program)
      }));

    return [...personal, ...group]
      .filter(entry => kind === 'ALL' || entry.kind === kind)
      .filter(entry => !createdDate || isoDate(entry.createdAt) === createdDate)
      .filter(entry => !normalizedQuery || `${entry.title} ${entry.subtitle}`.toLocaleLowerCase('he-IL').includes(normalizedQuery))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [personalPlans, groupPrograms, users, kind, query, createdDate]);

  if (!open) return null;

  return <div className="fixed inset-0 z-[160] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-5" dir="rtl" role="dialog" aria-modal="true" aria-label={title}>
    <section className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl border border-zinc-700 bg-zinc-950 text-white shadow-2xl sm:max-w-2xl sm:rounded-3xl">
      <header className="flex items-start justify-between gap-3 border-b border-zinc-800 p-4 sm:p-5">
        <div><span className="text-[10px] font-black text-amber-300">מאגר אימונים</span><h2 className="mt-1 text-xl font-black">{title}</h2><p className="mt-1 text-xs text-zinc-400">האימונים החדשים ביותר מוצגים ראשונים.</p></div>
        <button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-zinc-800" aria-label="סגירה"><X size={19} /></button>
      </header>

      <div className="space-y-3 border-b border-zinc-800 p-4">
        {!fixedKind && <div className="grid grid-cols-3 gap-2">
          {([['ALL', 'הכול'], ['PERSONAL', 'אישי'], ['GROUP', 'קבוצתי']] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setKind(value)} className={`min-h-10 rounded-xl text-xs font-black ${kind === value ? 'bg-amber-400 text-zinc-950' : 'bg-zinc-800 text-zinc-300'}`}>{label}</button>)}
        </div>}
        <div className="grid gap-2 sm:grid-cols-[1fr_180px]">
          <label className="flex min-h-11 items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3"><Search size={16} className="text-zinc-400" /><input value={query} onChange={event => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-500" placeholder="חיפוש לפי שם אימון או מתאמן" /></label>
          <label className="flex min-h-11 items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3"><CalendarDays size={16} className="text-zinc-400" /><input type="date" value={createdDate} onChange={event => setCreatedDate(event.target.value)} className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none [color-scheme:dark]" aria-label="סינון לפי תאריך יצירה" /></label>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
        {entries.map(entry => {
          const selected = choice?.kind === entry.kind && choice.id === entry.id;
          return <button key={`${entry.kind}-${entry.id}`} type="button" onClick={() => setChoice({ kind: entry.kind, id: entry.id })} className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-right transition ${selected ? 'border-amber-400 bg-amber-400/10' : 'border-zinc-700 bg-zinc-900 hover:border-zinc-500'}`}>
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${entry.kind === 'PERSONAL' ? 'bg-sky-500/20 text-sky-300' : 'bg-indigo-500/20 text-indigo-300'}`}>{entry.kind === 'PERSONAL' ? <UserRound size={20} /> : <UsersRound size={20} />}</span>
            <span className="min-w-0 flex-1"><strong className="block truncate text-sm text-white">{entry.title}</strong><small className="mt-1 block truncate text-[11px] text-zinc-400">{entry.kind === 'PERSONAL' ? 'אישי' : 'קבוצתי'} · {entry.subtitle}</small><small className="mt-1 block text-[10px] text-zinc-500">נוצר בתאריך {displayDate(entry.createdAt)}</small></span>
            {selected && <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-amber-400 text-zinc-950"><Check size={16} /></span>}
          </button>;
        })}
        {entries.length === 0 && <div className="rounded-2xl border border-dashed border-zinc-700 p-8 text-center text-sm text-zinc-400">לא נמצאו תוכניות התואמות לסינון.</div>}
      </div>

      <footer className="border-t border-zinc-800 p-4">
        <button type="button" disabled={!choice} onClick={() => choice && onSelect(choice.kind, choice.id)} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-400 text-sm font-black text-zinc-950 disabled:opacity-35"><Check size={18} /> בחר ושבץ את התוכנית</button>
      </footer>
    </section>
  </div>;
};
