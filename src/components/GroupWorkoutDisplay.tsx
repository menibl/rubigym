import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Maximize,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  X
} from 'lucide-react';
import { GroupWorkoutProgram } from '../types';
import { RotatingGroupWorkoutDisplay } from './RotatingGroupWorkoutDisplay';
import { ExerciseMedia } from './ExerciseMedia';

interface GroupWorkoutDisplayProps {
  program?: GroupWorkoutProgram;
}

type TimerPhase = 'PREPARE' | 'WORK' | 'REST' | 'COMPLETE';

const formatTime = (seconds: number) => {
  const minutes = Math.floor(Math.max(0, seconds) / 60);
  return `${String(minutes).padStart(2, '0')}:${String(Math.max(0, seconds) % 60).padStart(2, '0')}`;
};

const LinearGroupWorkoutDisplay: React.FC<GroupWorkoutDisplayProps> = ({ program }) => {
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [round, setRound] = useState(1);
  const [phase, setPhase] = useState<TimerPhase>('PREPARE');
  const [secondsLeft, setSecondsLeft] = useState(program?.preparationSeconds || 10);
  const [isRunning, setIsRunning] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  const currentExercise = program?.exercises[exerciseIndex];
  const nextExercise = program?.exercises[exerciseIndex + 1];
  const totalRounds = useMemo(() => program?.exercises.reduce((sum, exercise) => sum + exercise.rounds, 0) || 0, [program]);
  const completedRounds = useMemo(() => {
    if (!program) return 0;
    return program.exercises.slice(0, exerciseIndex).reduce((sum, exercise) => sum + exercise.rounds, 0)
      + (phase === 'COMPLETE' ? (currentExercise?.rounds || 0) : Math.max(0, round - 1));
  }, [currentExercise?.rounds, exerciseIndex, phase, program, round]);
  const progress = phase === 'COMPLETE' ? 100 : totalRounds ? Math.min(100, (completedRounds / totalRounds) * 100) : 0;

  const beep = (frequency = 880, duration = 0.12) => {
    try {
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const context = audioContextRef.current || new AudioContextClass();
      audioContextRef.current = context;
      if (context.state === 'suspended') void context.resume();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.18, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + duration);
    } catch {
      // Audio is a progressive enhancement and may be blocked by browser policy.
    }
  };

  const setWorkPhase = (index = exerciseIndex, targetRound = round) => {
    const exercise = program?.exercises[index];
    if (!exercise) return;
    setExerciseIndex(index);
    setRound(targetRound);
    setPhase('WORK');
    setSecondsLeft(exercise.workSeconds);
    beep(1100, 0.35);
  };

  const completeWorkout = () => {
    setPhase('COMPLETE');
    setSecondsLeft(0);
    setIsRunning(false);
    beep(1320, 0.7);
  };

  const advanceAfterRest = () => {
    if (!program || !currentExercise) return;
    if (round < currentExercise.rounds) {
      setWorkPhase(exerciseIndex, round + 1);
      return;
    }
    if (exerciseIndex < program.exercises.length - 1) {
      setWorkPhase(exerciseIndex + 1, 1);
      return;
    }
    completeWorkout();
  };

  const advancePhase = () => {
    if (!program || !currentExercise) return;
    if (phase === 'PREPARE') {
      setWorkPhase(0, 1);
    } else if (phase === 'WORK') {
      if (currentExercise.restSeconds > 0) {
        setPhase('REST');
        setSecondsLeft(currentExercise.restSeconds);
        beep(620, 0.35);
      } else {
        advanceAfterRest();
      }
    } else if (phase === 'REST') {
      advanceAfterRest();
    }
  };

  useEffect(() => {
    if (!isRunning || phase === 'COMPLETE') return;
    const timer = window.setInterval(() => {
      setSecondsLeft(current => {
        if (current <= 1) {
          window.setTimeout(advancePhase, 0);
          return 0;
        }
        const next = current - 1;
        if (next <= 3) beep(next === 1 ? 1050 : 850, 0.1);
        return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [exerciseIndex, isRunning, phase, round]);

  const resetWorkout = () => {
    setExerciseIndex(0);
    setRound(1);
    setPhase('PREPARE');
    setSecondsLeft(program?.preparationSeconds || 10);
    setIsRunning(false);
  };

  useEffect(() => {
    resetWorkout();
  }, [program?.id]);

  const nextStation = () => {
    if (!program) return;
    if (exerciseIndex < program.exercises.length - 1) setWorkPhase(exerciseIndex + 1, 1);
    else completeWorkout();
  };

  const previousStation = () => {
    if (exerciseIndex > 0) setWorkPhase(exerciseIndex - 1, 1);
    else resetWorkout();
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault();
        setIsRunning(value => !value);
      } else if (event.code === 'ArrowRight') {
        nextStation();
      } else if (event.code === 'ArrowLeft') {
        previousStation();
      } else if (event.key.toLowerCase() === 'r') {
        resetWorkout();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [exerciseIndex, program?.id]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) void document.documentElement.requestFullscreen();
    else void document.exitFullscreen();
  };

  const exitDisplay = () => {
    window.close();
    window.setTimeout(() => {
      window.location.hash = '';
    }, 100);
  };

  if (!program) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-center text-white" dir="rtl">
        <div><Dumbbell className="mx-auto mb-4 text-slate-500" size={52} /><h1 className="text-2xl font-black">תוכנית האימון לא נמצאה במכשיר זה</h1><p className="mt-3 text-slate-400">פתחו את מסך האימון מתוך מערכת הניהול באותו דפדפן.</p><button onClick={exitDisplay} className="mt-6 rounded-xl bg-white px-5 py-3 font-black text-slate-900">חזרה למערכת</button></div>
      </main>
    );
  }

  if (!currentExercise) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-center text-white" dir="rtl">
        <div><h1 className="text-3xl font-black">אין תרגילים בתוכנית</h1><button onClick={exitDisplay} className="mt-6 rounded-xl bg-white px-5 py-3 font-black text-slate-900">חזרה למערכת</button></div>
      </main>
    );
  }

  const phaseStyle = phase === 'WORK'
    ? 'from-emerald-500 to-green-600 text-white'
    : phase === 'REST'
      ? 'from-amber-400 to-orange-500 text-slate-950'
      : phase === 'COMPLETE'
        ? 'from-indigo-500 to-violet-600 text-white'
        : 'from-sky-500 to-blue-600 text-white';
  const phaseLabel = phase === 'WORK' ? 'עבודה' : phase === 'REST' ? 'מנוחה' : phase === 'COMPLETE' ? 'האימון הושלם!' : 'מתכוננים';

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-950 text-white" dir="rtl">
      <div className="flex min-h-screen flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-slate-950 px-5 py-3 lg:px-8">
          <div><p className="text-sm font-black text-indigo-300">{program.groupName}</p><h1 className="text-xl font-black lg:text-2xl">{program.title}</h1></div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-lg bg-white/5 px-3 py-2 text-xs text-slate-400 sm:block">רווח: הפעלה/עצירה · חצים: מעבר תחנה · R: איפוס</span>
            <button onClick={toggleFullscreen} className="rounded-lg bg-white/10 p-2.5 hover:bg-white/20" title="מסך מלא"><Maximize size={20} /></button>
            <button onClick={exitDisplay} className="rounded-lg bg-white/10 p-2.5 hover:bg-red-500/30" title="סגירה"><X size={20} /></button>
          </div>
        </header>

        <div className="h-2 bg-slate-800"><div className="h-full bg-gradient-to-l from-indigo-400 to-emerald-400 transition-all duration-500" style={{ width: `${progress}%` }} /></div>

        <section className="grid flex-1 lg:grid-cols-[minmax(0,1.45fr)_minmax(330px,0.55fr)]">
          <div className="flex min-h-[68vh] flex-col items-center justify-center p-5 text-center lg:p-10">
            <div className={`mb-5 rounded-full bg-gradient-to-l px-8 py-2 text-lg font-black shadow-lg ${phaseStyle}`}>{phaseLabel}</div>
            {phase !== 'COMPLETE' ? (
              <>
                <div className={`font-mono text-[clamp(6rem,20vw,15rem)] font-black leading-none tracking-tighter tabular-nums ${secondsLeft <= 3 ? 'animate-pulse text-red-400' : 'text-white'}`}>{formatTime(secondsLeft)}</div>
                <p className="mt-5 text-[clamp(2rem,5vw,4.5rem)] font-black leading-tight">{currentExercise.name}</p>
                {(currentExercise.mediaUrl || currentExercise.mediaStorageId) && <ExerciseMedia exercise={currentExercise} className="mt-5 max-h-[34vh] w-full max-w-xl" />}
                <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-lg font-bold text-slate-300">
                  <span className="rounded-xl bg-white/10 px-4 py-2">תחנה {exerciseIndex + 1}/{program.exercises.length}</span>
                  <span className="rounded-xl bg-white/10 px-4 py-2">סבב {round}/{currentExercise.rounds}</span>
                  {(currentExercise.weight || currentExercise.reps) && <span className="rounded-xl bg-white/10 px-4 py-2">{currentExercise.weight || currentExercise.reps}</span>}
                </div>
                {currentExercise.notes && <div className="mt-5 max-w-3xl rounded-xl border border-amber-400/30 bg-amber-400/10 px-5 py-3 text-right"><span className="block text-xs font-black text-amber-300">דגשי המאמן</span><p className="mt-1 text-lg text-white">{currentExercise.notes}</p></div>}
              </>
            ) : (
              <div className="py-16"><div className="text-8xl">🏆</div><h2 className="mt-5 text-5xl font-black">כל הכבוד!</h2><p className="mt-4 text-2xl text-slate-300">האימון הקבוצתי הסתיים</p></div>
            )}

            <div className="mt-8 flex items-center justify-center gap-3">
              <button onClick={previousStation} className="rounded-2xl bg-white/10 p-4 hover:bg-white/20"><ChevronRight size={30} /></button>
              <button onClick={() => { beep(880, 0.1); setIsRunning(value => !value); }} disabled={phase === 'COMPLETE'} className={`flex h-20 w-20 items-center justify-center rounded-full shadow-2xl transition hover:scale-105 disabled:opacity-40 ${isRunning ? 'bg-amber-400 text-slate-950' : 'bg-emerald-500 text-white'}`}>{isRunning ? <Pause size={38} fill="currentColor" /> : <Play size={38} fill="currentColor" />}</button>
              <button onClick={nextStation} className="rounded-2xl bg-white/10 p-4 hover:bg-white/20"><ChevronLeft size={30} /></button>
              <button onClick={resetWorkout} className="mr-3 rounded-2xl bg-white/10 p-4 hover:bg-white/20"><RotateCcw size={26} /></button>
              <button onClick={() => beep(880, 0.15)} className="rounded-2xl bg-white/10 p-4 hover:bg-white/20" title="בדיקת צליל"><Volume2 size={26} /></button>
            </div>
          </div>

          <aside className="border-t border-white/10 bg-slate-900/70 p-4 lg:border-r lg:border-t-0 lg:p-6">
            <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-black">מהלך האימון</h2><span className="text-xs text-slate-400">{Math.round(progress)}%</span></div>
            <div className="max-h-[74vh] space-y-2 overflow-y-auto pl-1">
              {program.exercises.map((exercise, index) => (
                <button key={exercise.id} onClick={() => setWorkPhase(index, 1)} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-right transition ${index === exerciseIndex && phase !== 'COMPLETE' ? 'border-indigo-400 bg-indigo-500/20' : index < exerciseIndex || phase === 'COMPLETE' ? 'border-emerald-500/20 bg-emerald-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black ${index < exerciseIndex || phase === 'COMPLETE' ? 'bg-emerald-500 text-white' : index === exerciseIndex ? 'bg-indigo-500 text-white' : 'bg-white/10 text-slate-300'}`}>{index < exerciseIndex || phase === 'COMPLETE' ? '✓' : index + 1}</span>
                  <span className="min-w-0 flex-1"><strong className="block truncate text-sm">{exercise.name}</strong><small className="text-slate-400">{exercise.workSeconds} שנ׳ עבודה · {exercise.restSeconds} שנ׳ מנוחה · {exercise.rounds} סבבים</small></span>
                </button>
              ))}
            </div>
            {nextExercise && phase !== 'COMPLETE' && <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4"><p className="text-xs font-bold text-slate-400">הבא בתור</p><p className="mt-1 text-lg font-black">{nextExercise.name}</p></div>}
          </aside>
        </section>
      </div>
    </main>
  );
};

export const GroupWorkoutDisplay: React.FC<GroupWorkoutDisplayProps> = ({ program }) => {
  if (program?.mode === 'ROTATING_GROUPS') return <RotatingGroupWorkoutDisplay program={program} />;
  return <LinearGroupWorkoutDisplay program={program} />;
};
