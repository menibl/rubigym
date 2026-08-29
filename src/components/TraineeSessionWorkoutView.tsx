import React from 'react';
import { ArrowRight, Clock3, Dumbbell, RotateCcw, TimerReset } from 'lucide-react';
import { GroupWorkoutExercise, GroupWorkoutProgram, TrainingSession } from '../types';
import { ExerciseMedia } from './ExerciseMedia';
import { RubisLogo } from './RubisLogo';

interface TraineeSessionWorkoutViewProps {
  program: GroupWorkoutProgram;
  session: TrainingSession;
}

interface ExerciseSection {
  id: string;
  title: string;
  exercises: GroupWorkoutExercise[];
}

const buildSections = (program: GroupWorkoutProgram): ExerciseSection[] => {
  if (program.stations?.length) {
    return program.stations.map((station, index) => ({
      id: station.id,
      title: station.name || `תחנה ${index + 1}`,
      exercises: station.exercises
    }));
  }
  return [{ id: 'all-exercises', title: 'כל תרגילי האימון', exercises: program.exercises }];
};

const valueOrDash = (value?: string | number) => value === undefined || value === '' ? '—' : value;

export const TraineeSessionWorkoutView: React.FC<TraineeSessionWorkoutViewProps> = ({ program, session }) => {
  const sections = buildSections(program);
  const exerciseCount = sections.reduce((total, section) => total + section.exercises.length, 0);
  const isRepetitionBased = program.effortMetric === 'REPS';
  const closeView = () => {
    window.close();
    window.setTimeout(() => window.history.back(), 100);
  };

  return (
    <main className="min-h-dvh bg-zinc-950 pb-10 text-zinc-100" dir="rtl">
      <header className="sticky top-0 z-20 border-b border-amber-400/25 bg-zinc-950/95 px-4 py-3 shadow-xl backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-black text-amber-400">{session.date} · {session.time} · {session.durationMinutes} דקות</p>
            <h1 className="truncate text-lg font-black text-white">{program.title || session.title}</h1>
            <p className="truncate text-xs text-zinc-400">מאמן: {program.coachName || session.coachName}</p>
          </div>
          <RubisLogo size={76} />
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-4 px-4 pt-4">
        <section className="rounded-2xl border border-zinc-700 bg-zinc-900 p-4 shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="rounded-full bg-amber-400/15 px-2.5 py-1 text-[10px] font-black text-amber-300">תוכנית האימון שלך</span>
              <h2 className="mt-3 text-xl font-black text-white">{session.title}</h2>
              {program.description && <p className="mt-1 text-sm leading-6 text-zinc-300">{program.description}</p>}
            </div>
            <Dumbbell className="mt-1 shrink-0 text-amber-400" size={28} />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-zinc-800 p-2"><strong className="block text-lg text-white">{exerciseCount}</strong><span className="text-[10px] text-zinc-400">תרגילים</span></div>
            <div className="rounded-xl bg-zinc-800 p-2"><strong className="block text-lg text-white">{program.roundsPerStation || 1}</strong><span className="text-[10px] text-zinc-400">מחזורים</span></div>
            <div className="rounded-xl bg-zinc-800 p-2"><strong className="block text-lg text-white">{sections.length}</strong><span className="text-[10px] text-zinc-400">תחנות</span></div>
          </div>
        </section>

        {sections.map((section, sectionIndex) => (
          <section key={section.id} className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-amber-400 text-xs font-black text-zinc-950">{sectionIndex + 1}</span>
              <h2 className="text-base font-black text-white">{section.title}</h2>
            </div>
            {section.exercises.map((exercise, exerciseIndex) => (
              <article key={`${section.id}-${exercise.id}-${exerciseIndex}`} className="overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900 shadow-lg">
                <div className="flex items-start gap-3 p-4">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-400 text-base font-black text-zinc-950">{exerciseIndex + 1}</span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-black leading-6 text-white">{exercise.name}</h3>
                    <p className="mt-0.5 text-xs font-bold text-amber-300">{exercise.category}</p>
                  </div>
                </div>

                {(exercise.mediaUrl || exercise.mediaStorageId) && (
                  <ExerciseMedia exercise={exercise} compact controls className="mx-4 mb-4" />
                )}

                <div className={`grid grid-cols-2 gap-px border-y border-zinc-700 bg-zinc-700 ${isRepetitionBased ? '' : 'sm:grid-cols-4'}`}>
                  <div className="bg-zinc-900 p-3"><span className="block text-[10px] text-zinc-400">חזרות</span><strong className="text-sm text-white">{valueOrDash(exercise.reps || program.defaultRepetitions)}</strong></div>
                  <div className="bg-zinc-900 p-3"><span className="block text-[10px] text-zinc-400">סטים / סבבים</span><strong className="text-sm text-white">{exercise.rounds || exercise.sets || 1}</strong></div>
                  {!isRepetitionBased && <div className="bg-zinc-900 p-3"><span className="block text-[10px] text-zinc-400">זמן עבודה</span><strong className="text-sm text-white">{exercise.workSeconds || program.defaultWorkSeconds} שנ׳</strong></div>}
                  {!isRepetitionBased && <div className="bg-zinc-900 p-3"><span className="block text-[10px] text-zinc-400">מנוחה</span><strong className="text-sm text-white">{exercise.restSeconds || program.defaultRestSeconds} שנ׳</strong></div>}
                </div>

                <div className="space-y-2 p-4 text-sm">
                  {exercise.weight && <p className="flex items-center gap-2 text-zinc-200"><Dumbbell size={15} className="text-amber-400" /><strong>משקל מומלץ:</strong> {exercise.weight}</p>}
                  {exercise.notes && <p className="rounded-xl bg-amber-400/10 p-3 leading-6 text-amber-100"><strong>דגשי המאמן:</strong> {exercise.notes}</p>}
                </div>
              </article>
            ))}
          </section>
        ))}

        {exerciseCount === 0 && (
          <div className="rounded-2xl border border-dashed border-zinc-700 p-8 text-center text-sm text-zinc-400">עדיין לא נוספו תרגילים לתוכנית הזאת.</div>
        )}

        <section className="grid grid-cols-2 gap-2 rounded-2xl border border-zinc-700 bg-zinc-900 p-3 text-xs text-zinc-300">
          {isRepetitionBased
            ? <span className="col-span-2 flex items-center gap-2"><RotateCcw size={15} className="text-amber-400" /> מדידה לפי חזרות: {program.defaultRepetitions || 'לפי התרגיל'}</span>
            : <><span className="flex items-center gap-2"><Clock3 size={15} className="text-amber-400" /> עבודה: {program.defaultWorkSeconds} שנ׳</span><span className="flex items-center gap-2"><TimerReset size={15} className="text-amber-400" /> מנוחה: {program.defaultRestSeconds} שנ׳</span></>}
          {!isRepetitionBased && <span className="flex items-center gap-2"><RotateCcw size={15} className="text-amber-400" /> מעבר: {program.transitionSeconds || 0} שנ׳</span>}
        </section>

        <button type="button" onClick={closeView} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 text-sm font-black text-white">
          <ArrowRight size={17} /> חזרה לאפליקציה
        </button>
      </div>
    </main>
  );
};
