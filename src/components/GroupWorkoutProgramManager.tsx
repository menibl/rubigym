import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Copy,
  Dumbbell,
  ExternalLink,
  MonitorPlay,
  Plus,
  Save,
  Trash2,
  UsersRound
} from 'lucide-react';
import { GroupWorkoutExercise, GroupWorkoutProgram, MuscleGroup, User } from '../types';

interface GroupWorkoutProgramManagerProps {
  activeUser: User;
  programs: GroupWorkoutProgram[];
  onUpdatePrograms: (programs: GroupWorkoutProgram[]) => void;
}

const createExercise = (index: number, workSeconds: number, restSeconds: number): GroupWorkoutExercise => ({
  id: `group-exercise-${Date.now()}-${index}`,
  name: '',
  category: 'תחנה',
  muscleGroup: MuscleGroup.FUNCTIONAL,
  sets: 1,
  reps: 'לפי זמן',
  weight: '',
  workDuration: `${workSeconds} שניות`,
  restDuration: `${restSeconds} שניות`,
  mediaUrl: '',
  notes: '',
  workSeconds,
  restSeconds,
  rounds: 1
});

const formatDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}:${String(remaining).padStart(2, '0')}`;
};

const totalProgramSeconds = (program: GroupWorkoutProgram) => program.preparationSeconds + program.exercises.reduce(
  (sum, exercise) => sum + ((exercise.workSeconds + exercise.restSeconds) * exercise.rounds),
  0
);

export const GroupWorkoutProgramManager: React.FC<GroupWorkoutProgramManagerProps> = ({
  activeUser,
  programs,
  onUpdatePrograms
}) => {
  const [selectedProgramId, setSelectedProgramId] = useState(programs[0]?.id || '');
  const selectedProgram = programs.find(program => program.id === selectedProgramId);

  useEffect(() => {
    if (!selectedProgramId && programs[0]) setSelectedProgramId(programs[0].id);
    if (selectedProgramId && !programs.some(program => program.id === selectedProgramId)) {
      setSelectedProgramId(programs[0]?.id || '');
    }
  }, [programs, selectedProgramId]);

  const sortedPrograms = useMemo(
    () => [...programs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [programs]
  );

  const updateProgram = (changes: Partial<GroupWorkoutProgram>) => {
    if (!selectedProgram) return;
    onUpdatePrograms(programs.map(program => program.id === selectedProgram.id
      ? { ...program, ...changes, updatedAt: new Date().toISOString(), status: changes.status ?? 'DRAFT' }
      : program));
  };

  const createProgram = () => {
    const now = new Date().toISOString();
    const program: GroupWorkoutProgram = {
      id: `group-program-${Date.now()}`,
      groupName: 'קבוצה חדשה',
      title: 'אימון קבוצתי',
      description: '',
      coachId: activeUser.id,
      coachName: activeUser.name,
      exercises: [],
      defaultWorkSeconds: 40,
      defaultRestSeconds: 20,
      preparationSeconds: 10,
      status: 'DRAFT',
      createdAt: now,
      updatedAt: now
    };
    onUpdatePrograms([program, ...programs]);
    setSelectedProgramId(program.id);
  };

  const duplicateProgram = (program: GroupWorkoutProgram) => {
    const now = new Date().toISOString();
    const duplicate: GroupWorkoutProgram = {
      ...program,
      id: `group-program-${Date.now()}`,
      groupName: `${program.groupName} – עותק`,
      exercises: program.exercises.map((exercise, index) => ({ ...exercise, id: `group-exercise-${Date.now()}-${index}` })),
      coachId: activeUser.id,
      coachName: activeUser.name,
      status: 'DRAFT',
      createdAt: now,
      updatedAt: now,
      publishedAt: undefined
    };
    onUpdatePrograms([duplicate, ...programs]);
    setSelectedProgramId(duplicate.id);
  };

  const deleteProgram = (program: GroupWorkoutProgram) => {
    if (!window.confirm(`למחוק את התוכנית “${program.groupName}”?`)) return;
    onUpdatePrograms(programs.filter(item => item.id !== program.id));
  };

  const addExercise = () => {
    if (!selectedProgram) return;
    updateProgram({
      exercises: [
        ...selectedProgram.exercises,
        createExercise(selectedProgram.exercises.length, selectedProgram.defaultWorkSeconds, selectedProgram.defaultRestSeconds)
      ]
    });
  };

  const updateExercise = (exerciseId: string, changes: Partial<GroupWorkoutExercise>) => {
    if (!selectedProgram) return;
    updateProgram({
      exercises: selectedProgram.exercises.map(exercise => exercise.id === exerciseId
        ? {
            ...exercise,
            ...changes,
            workDuration: changes.workSeconds !== undefined ? `${changes.workSeconds} שניות` : exercise.workDuration,
            restDuration: changes.restSeconds !== undefined ? `${changes.restSeconds} שניות` : exercise.restDuration
          }
        : exercise)
    });
  };

  const moveExercise = (index: number, direction: -1 | 1) => {
    if (!selectedProgram) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= selectedProgram.exercises.length) return;
    const exercises = [...selectedProgram.exercises];
    [exercises[index], exercises[nextIndex]] = [exercises[nextIndex], exercises[index]];
    updateProgram({ exercises });
  };

  const openDisplay = (program: GroupWorkoutProgram) => {
    const displayUrl = `${window.location.origin}${window.location.pathname}#group-workout-display=${encodeURIComponent(program.id)}`;
    window.open(displayUrl, '_blank', 'noopener,noreferrer');
  };

  const publishProgram = () => {
    if (!selectedProgram || selectedProgram.exercises.length === 0 || selectedProgram.exercises.some(exercise => !exercise.name.trim())) return;
    updateProgram({ status: 'PUBLISHED', publishedAt: new Date().toISOString() });
  };

  return (
    <section className="space-y-5" dir="rtl">
      <div className="rounded-2xl bg-gradient-to-l from-slate-950 via-slate-900 to-indigo-950 p-5 text-white shadow-lg">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-indigo-300"><UsersRound size={20} /><span className="text-sm font-extrabold">אימוני קבוצות</span></div>
            <h2 className="text-2xl font-black">מנהל תוכניות אימון קבוצתיות</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">בנו את סדר האימון, הגדירו זמני עבודה ומנוחה ופתחו מסך נקי להצגה למאמן או על מסך המועדון.</p>
          </div>
          <button onClick={createProgram} className="flex items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-3 text-sm font-black text-white hover:bg-indigo-400"><Plus size={18} /> תוכנית קבוצה חדשה</button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <h3 className="px-2 pb-3 text-sm font-black text-slate-800">הקבוצות והתוכניות שלי</h3>
          <div className="space-y-2">
            {sortedPrograms.map(program => (
              <button key={program.id} onClick={() => setSelectedProgramId(program.id)} className={`w-full rounded-xl border p-3 text-right transition ${selectedProgramId === program.id ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                <div className="flex items-start justify-between gap-2"><strong className="text-sm text-slate-900">{program.groupName}</strong><span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${program.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>{program.status === 'PUBLISHED' ? 'פורסם' : 'טיוטה'}</span></div>
                <p className="mt-1 truncate text-xs text-slate-500">{program.title}</p>
                <p className="mt-2 text-[10px] text-slate-400">{program.exercises.length} תרגילים · {formatDuration(totalProgramSeconds(program))}</p>
              </button>
            ))}
            {programs.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500">עדיין לא נבנתה תוכנית קבוצתית.</div>}
          </div>
        </aside>

        {selectedProgram ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div><h3 className="text-lg font-black text-slate-900">פרטי הקבוצה והאימון</h3><p className="text-xs text-slate-500">השינויים נשמרים אוטומטית במכשיר</p></div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => duplicateProgram(selectedProgram)} className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"><Copy size={14} /> שכפול</button>
                  <button onClick={() => deleteProgram(selectedProgram)} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50"><Trash2 size={14} /> מחיקה</button>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-xs font-bold text-slate-700">שם הקבוצה<input value={selectedProgram.groupName} onChange={event => updateProgram({ groupName: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" placeholder="לדוגמה: אימון בנים ערב" /></label>
                <label className="text-xs font-bold text-slate-700">שם האימון<input value={selectedProgram.title} onChange={event => updateProgram({ title: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" placeholder="לדוגמה: כוח וסבולת – יום ראשון" /></label>
                <label className="md:col-span-2 text-xs font-bold text-slate-700">דגשים למאמן<textarea value={selectedProgram.description} onChange={event => updateProgram({ description: event.target.value })} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" placeholder="מטרת האימון, התאמות ודגשים לקבוצה" /></label>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 rounded-xl bg-slate-50 p-3">
                <label className="text-[10px] font-bold text-slate-600">הכנה לפני התחלה<input type="number" min={0} max={120} value={selectedProgram.preparationSeconds} onChange={event => updateProgram({ preparationSeconds: Number(event.target.value) })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs" /></label>
                <label className="text-[10px] font-bold text-slate-600">ברירת מחדל עבודה<input type="number" min={5} max={600} value={selectedProgram.defaultWorkSeconds} onChange={event => updateProgram({ defaultWorkSeconds: Number(event.target.value) })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs" /></label>
                <label className="text-[10px] font-bold text-slate-600">ברירת מחדל מנוחה<input type="number" min={0} max={300} value={selectedProgram.defaultRestSeconds} onChange={event => updateProgram({ defaultRestSeconds: Number(event.target.value) })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs" /></label>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3"><div><h3 className="flex items-center gap-2 text-lg font-black text-slate-900"><Dumbbell size={19} className="text-indigo-600" /> סדר התרגילים והתחנות</h3><p className="mt-1 text-xs text-slate-500">משך משוער: {formatDuration(totalProgramSeconds(selectedProgram))}</p></div><button onClick={addExercise} className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-black text-white hover:bg-indigo-700"><Plus size={15} /> הוסף תרגיל</button></div>
              <div className="space-y-3">
                {selectedProgram.exercises.map((exercise, index) => (
                  <article key={exercise.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
                      <div className="flex items-center gap-1"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-black text-indigo-700">{index + 1}</span><button onClick={() => moveExercise(index, -1)} disabled={index === 0} className="rounded p-1 text-slate-500 disabled:opacity-20"><ArrowUp size={14} /></button><button onClick={() => moveExercise(index, 1)} disabled={index === selectedProgram.exercises.length - 1} className="rounded p-1 text-slate-500 disabled:opacity-20"><ArrowDown size={14} /></button></div>
                      <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2 lg:grid-cols-6">
                        <label className="sm:col-span-2 text-[9px] font-bold text-slate-500">שם התרגיל<input value={exercise.name} onChange={event => updateExercise(exercise.id, { name: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs font-bold text-slate-800" placeholder="לדוגמה: Battle Rope" /></label>
                        <label className="text-[9px] font-bold text-slate-500">עבודה<input type="number" min={5} max={600} value={exercise.workSeconds} onChange={event => updateExercise(exercise.id, { workSeconds: Number(event.target.value) })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs" /></label>
                        <label className="text-[9px] font-bold text-slate-500">מנוחה<input type="number" min={0} max={300} value={exercise.restSeconds} onChange={event => updateExercise(exercise.id, { restSeconds: Number(event.target.value) })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs" /></label>
                        <label className="text-[9px] font-bold text-slate-500">סבבים<input type="number" min={1} max={20} value={exercise.rounds} onChange={event => updateExercise(exercise.id, { rounds: Number(event.target.value) })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs" /></label>
                        <label className="text-[9px] font-bold text-slate-500">חזרות / משקל<input value={exercise.weight || exercise.reps} onChange={event => updateExercise(exercise.id, { weight: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs" placeholder="לפי זמן" /></label>
                        <label className="sm:col-span-2 lg:col-span-5 text-[9px] font-bold text-slate-500">הנחיות למאמן<input value={exercise.notes || ''} onChange={event => updateExercise(exercise.id, { notes: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs" placeholder="טכניקה, התאמות או ציוד נדרש" /></label>
                        <label className="text-[9px] font-bold text-slate-500">סרטון הדגמה<input value={exercise.mediaUrl || ''} onChange={event => updateExercise(exercise.id, { mediaUrl: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs" placeholder="קישור אופציונלי" /></label>
                      </div>
                      <button onClick={() => updateProgram({ exercises: selectedProgram.exercises.filter(item => item.id !== exercise.id) })} className="self-start rounded-lg p-2 text-red-500 hover:bg-red-50"><Trash2 size={16} /></button>
                    </div>
                  </article>
                ))}
                {selectedProgram.exercises.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">הוסיפו את התרגיל או התחנה הראשונה.</div>}
              </div>
            </div>

            <div className="sticky bottom-3 flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-center gap-2 text-xs font-bold text-slate-600"><Save size={15} className="text-emerald-600" /> נשמר לאחרונה {new Date(selectedProgram.updatedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</p>
              <div className="flex flex-wrap gap-2">
                <button onClick={publishProgram} disabled={!selectedProgram.exercises.length || selectedProgram.exercises.some(exercise => !exercise.name.trim())} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white disabled:opacity-40"><CheckCircle2 size={16} /> פרסם תוכנית</button>
                <button onClick={() => openDisplay(selectedProgram)} disabled={selectedProgram.status !== 'PUBLISHED'} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-black text-white disabled:opacity-40"><MonitorPlay size={16} /> פתח מסך אימון <ExternalLink size={13} /></button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex min-h-96 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center"><div><UsersRound className="mx-auto mb-3 text-slate-400" size={38} /><p className="font-black text-slate-700">צרו קבוצה כדי להתחיל לבנות תוכנית</p></div></div>
        )}
      </div>
    </section>
  );
};
