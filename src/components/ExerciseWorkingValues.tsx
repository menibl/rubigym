import React, { useEffect, useId, useState } from 'react';
import { type Exercise } from '../types';
import { saveExerciseWorkingValues } from '../data/clubServer';

export function ExerciseWorkingValues({ planId, exercise }: { planId: string; exercise: Exercise }) {
  const id = useId();
  const [saved, setSaved] = useState(exercise.workingValues);
  const [weight, setWeight] = useState(exercise.workingValues?.weightKg || '');
  const [rest, setRest] = useState(exercise.workingValues?.restSeconds || '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const dirty = weight !== (saved?.weightKg || '') || rest !== (saved?.restSeconds || '');
  useEffect(() => {
    if ((exercise.workingValues?.revision || 0) <= (saved?.revision || 0) || busy || dirty) return;
    setSaved(exercise.workingValues);
    setWeight(exercise.workingValues?.weightKg || '');
    setRest(exercise.workingValues?.restSeconds || '');
  }, [exercise.workingValues, saved, busy, dirty]);
  const save = async () => {
    setBusy(true); setMessage(''); setFailed(false);
    try {
      const value = await saveExerciseWorkingValues({ planId, exerciseId: exercise.id, weightKg: weight, restSeconds: rest, expectedRevision: saved?.revision || 0 });
      setSaved(value); setWeight(value.weightKg); setRest(value.restSeconds); setMessage('הערכים נשמרו');
    } catch (error) { setFailed(true); setMessage((error as Error).message || 'השמירה נכשלה. יש לנסות שוב.'); }
    finally { setBusy(false); }
  };
  return <fieldset disabled={busy} className="my-3 min-w-0 rounded-xl border border-slate-600 bg-slate-950 p-3 text-slate-100" dir="rtl">
    <legend className="px-1 text-xs font-bold text-slate-100">משקל ומנוחה — {exercise.name}</legend>
    <div className="grid grid-cols-2 gap-3">
      <label htmlFor={`${id}-weight`} className="text-xs">משקל עבודה (ק״ג)
        <input id={`${id}-weight`} type="number" inputMode="decimal" min="0" max="1500" step="0.01" value={weight} onChange={event => { setWeight(event.target.value); setMessage(''); }} placeholder="לא הוזן" className="mt-1 min-h-11 w-full rounded-lg border border-slate-500 bg-slate-900 p-2 text-base text-white" />
      </label>
      <label htmlFor={`${id}-rest`} className="text-xs">זמן מנוחה (שניות)
        <input id={`${id}-rest`} type="number" inputMode="numeric" min="0" max="3600" step="1" value={rest} onChange={event => { setRest(event.target.value); setMessage(''); }} placeholder="לא הוזן" className="mt-1 min-h-11 w-full rounded-lg border border-slate-500 bg-slate-900 p-2 text-base text-white" />
      </label>
    </div>
    <p className="mt-2 text-xs text-slate-300">המאמן והמתאמן יכולים לעדכן. הערכים אינם משנים את טיימר האימון.</p>
    <button type="button" disabled={busy || !dirty} onClick={() => void save()} className="mt-2 min-h-11 w-full rounded-lg border border-amber-400/60 bg-slate-800 px-3 text-sm font-bold text-amber-200 disabled:opacity-50" aria-label={`שמירת משקל ומנוחה לתרגיל ${exercise.name}`}>{busy ? 'שומר…' : 'שמירת משקל ומנוחה'}</button>
    {message && <p role={failed ? 'alert' : 'status'} className={`mt-2 text-xs ${failed ? 'text-rose-200' : 'text-emerald-200'}`}>{message}</p>}
  </fieldset>;
}
