import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize, Pause, Play, RotateCcw, Volume2, X } from 'lucide-react';
import { GroupWorkoutProgram } from '../types';
import { ExerciseMedia } from './ExerciseMedia';

interface RotatingGroupWorkoutDisplayProps {
  program: GroupWorkoutProgram;
}

type RotationPhase = 'PREPARE' | 'WORK' | 'REST' | 'TRANSITION' | 'COMPLETE';

const formatTime = (seconds: number) => `${String(Math.floor(Math.max(0, seconds) / 60)).padStart(2, '0')}:${String(Math.max(0, seconds) % 60).padStart(2, '0')}`;

export const RotatingGroupWorkoutDisplay: React.FC<RotatingGroupWorkoutDisplayProps> = ({ program }) => {
  const stations = program.stations || [];
  const roundsPerStation = program.roundsPerStation || 1;
  const maxExercises = Math.max(1, ...stations.map(station => station.exercises.length));
  const [rotationIndex, setRotationIndex] = useState(0);
  const [chainRound, setChainRound] = useState(1);
  const [exerciseSlot, setExerciseSlot] = useState(0);
  const [phase, setPhase] = useState<RotationPhase>('PREPARE');
  const [secondsLeft, setSecondsLeft] = useState(program.preparationSeconds || 10);
  const [isRunning, setIsRunning] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  const totalSteps = Math.max(1, stations.length * roundsPerStation * maxExercises);
  const completedSteps = rotationIndex * roundsPerStation * maxExercises + (chainRound - 1) * maxExercises + exerciseSlot;
  const progress = phase === 'COMPLETE' ? 100 : Math.min(100, (completedSteps / totalSteps) * 100);
  const peoplePerGroup = Math.ceil((program.participantCount || stations.length) / Math.max(1, stations.length));

  const assignments = useMemo(() => stations.map((_, participantGroupIndex) => {
    const stationIndex = (participantGroupIndex + rotationIndex) % stations.length;
    const station = stations[stationIndex];
    return {
      participantGroupIndex,
      participantGroupName: (program.participantGroupNames || [])[participantGroupIndex] || `קבוצה ${participantGroupIndex + 1}`,
      station,
      exercise: station?.exercises[exerciseSlot]
    };
  }), [exerciseSlot, program.participantGroupNames, rotationIndex, stations]);

  const beep = (frequency = 880, duration = 0.12) => {
    try {
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const context = audioContextRef.current || new AudioContextClass();
      audioContextRef.current = context;
      if (context.state === 'suspended') void context.resume();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.2, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + duration);
    } catch {
      // Browsers may block sound until the user presses play.
    }
  };

  const startWork = () => {
    setPhase('WORK');
    setSecondsLeft(program.defaultWorkSeconds);
    beep(1100, 0.35);
  };

  const completeWorkout = () => {
    setPhase('COMPLETE');
    setSecondsLeft(0);
    setIsRunning(false);
    beep(1320, 0.7);
  };

  const advanceStep = () => {
    if (exerciseSlot < maxExercises - 1) {
      setExerciseSlot(value => value + 1);
      startWork();
    } else if (chainRound < roundsPerStation) {
      setExerciseSlot(0);
      setChainRound(value => value + 1);
      startWork();
    } else if (rotationIndex < stations.length - 1) {
      setPhase('TRANSITION');
      setSecondsLeft(program.transitionSeconds || 0);
      if ((program.transitionSeconds || 0) === 0) {
        setRotationIndex(value => value + 1);
        setChainRound(1);
        setExerciseSlot(0);
        window.setTimeout(startWork, 0);
      } else {
        beep(540, 0.55);
      }
    } else {
      completeWorkout();
    }
  };

  const advancePhase = () => {
    if (phase === 'PREPARE') startWork();
    else if (phase === 'WORK') {
      if (program.defaultRestSeconds > 0) {
        setPhase('REST');
        setSecondsLeft(program.defaultRestSeconds);
        beep(650, 0.3);
      } else advanceStep();
    } else if (phase === 'REST') advanceStep();
    else if (phase === 'TRANSITION') {
      setRotationIndex(value => value + 1);
      setChainRound(1);
      setExerciseSlot(0);
      startWork();
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
  }, [chainRound, exerciseSlot, isRunning, phase, rotationIndex]);

  const resetWorkout = () => {
    setRotationIndex(0);
    setChainRound(1);
    setExerciseSlot(0);
    setPhase('PREPARE');
    setSecondsLeft(program.preparationSeconds || 10);
    setIsRunning(false);
  };

  const previousStep = () => {
    if (exerciseSlot > 0) setExerciseSlot(value => value - 1);
    else if (chainRound > 1) {
      setChainRound(value => value - 1);
      setExerciseSlot(maxExercises - 1);
    } else if (rotationIndex > 0) {
      setRotationIndex(value => value - 1);
      setChainRound(roundsPerStation);
      setExerciseSlot(maxExercises - 1);
    } else {
      resetWorkout();
      return;
    }
    setPhase('WORK');
    setSecondsLeft(program.defaultWorkSeconds);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault();
        setIsRunning(value => !value);
      } else if (event.code === 'ArrowRight') previousStep();
      else if (event.code === 'ArrowLeft') advanceStep();
      else if (event.key.toLowerCase() === 'r') resetWorkout();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [chainRound, exerciseSlot, rotationIndex]);

  const exitDisplay = () => {
    window.close();
    window.setTimeout(() => { window.location.hash = ''; }, 100);
  };

  if (stations.length === 0 || stations.every(station => station.exercises.length === 0)) {
    return <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-center text-white" dir="rtl"><div><h1 className="text-3xl font-black">לא הוגדרו תחנות ותרגילים</h1><button onClick={exitDisplay} className="mt-6 rounded-xl bg-white px-5 py-3 font-black text-slate-900">חזרה למערכת</button></div></main>;
  }

  const phaseLabel = phase === 'WORK' ? 'עבודה' : phase === 'REST' ? 'מנוחה' : phase === 'TRANSITION' ? 'החלפת תחנות' : phase === 'COMPLETE' ? 'האימון הושלם!' : 'מתכוננים';
  const phaseColors = phase === 'WORK' ? 'from-emerald-500 to-green-600' : phase === 'REST' ? 'from-amber-400 to-orange-500 text-slate-950' : phase === 'TRANSITION' ? 'from-fuchsia-500 to-violet-600' : phase === 'COMPLETE' ? 'from-indigo-500 to-violet-600' : 'from-sky-500 to-blue-600';

  return (
    <main className="min-h-screen bg-slate-950 text-white" dir="rtl">
      <div className="flex min-h-screen flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-3 lg:px-8">
          <div><p className="text-sm font-black text-indigo-300">{program.groupName} · {program.participantCount || 0} משתתפים</p><h1 className="text-xl font-black lg:text-2xl">{program.title}</h1></div>
          <div className="flex items-center gap-2"><span className="hidden rounded-lg bg-white/5 px-3 py-2 text-xs text-slate-400 sm:block">סבב {chainRound}/{roundsPerStation} · החלפה {rotationIndex + 1}/{stations.length}</span><button onClick={() => void (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen())} className="rounded-lg bg-white/10 p-2.5"><Maximize size={20} /></button><button onClick={exitDisplay} className="rounded-lg bg-white/10 p-2.5"><X size={20} /></button></div>
        </header>
        <div className="h-2 bg-slate-800"><div className="h-full bg-gradient-to-l from-indigo-400 to-emerald-400 transition-all" style={{ width: `${progress}%` }} /></div>

        <section className="flex flex-1 flex-col p-4 lg:p-6">
          <div className="mb-5 flex flex-col items-center justify-center text-center">
            <span className={`rounded-full bg-gradient-to-l px-8 py-2 text-lg font-black ${phaseColors}`}>{phaseLabel}</span>
            <div className={`mt-2 font-mono text-[clamp(5rem,13vw,10rem)] font-black leading-none tabular-nums ${secondsLeft <= 3 && phase !== 'COMPLETE' ? 'animate-pulse text-red-400' : ''}`}>{formatTime(secondsLeft)}</div>
            {phase === 'TRANSITION' && <p className="mt-2 text-2xl font-black text-fuchsia-300">כל קבוצה עוברת לתחנה הבאה ←</p>}
          </div>

          {phase === 'COMPLETE' ? <div className="flex flex-1 flex-col items-center justify-center py-10"><div className="text-8xl">🏆</div><h2 className="mt-4 text-5xl font-black">כל הכבוד לכולם!</h2></div> : (
            <div className={`grid flex-1 gap-3 ${assignments.length <= 2 ? 'md:grid-cols-2' : assignments.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2 xl:grid-cols-4'}`}>
              {assignments.map(({ participantGroupIndex, participantGroupName, station, exercise }) => (
                <article key={participantGroupIndex} className={`flex min-h-48 flex-col rounded-2xl border p-4 shadow-xl transition ${exercise ? 'border-indigo-400/40 bg-gradient-to-b from-indigo-950/80 to-slate-900' : 'border-white/10 bg-slate-900/60'}`}>
                  <div className="flex items-start justify-between gap-2"><div><p className="text-sm font-black text-indigo-300">{participantGroupName}</p><p className="text-xs text-slate-400">כ־{peoplePerGroup} מתאמנים</p></div><span className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-bold">{station?.name}</span></div>
                  <div className="flex flex-1 flex-col items-center justify-center py-4 text-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">תרגיל {exerciseSlot + 1}</p>
                    <h2 className="mt-2 text-[clamp(1.5rem,3vw,2.6rem)] font-black leading-tight">{exercise?.name || 'המתנה / התאוששות'}</h2>
                    {exercise && (exercise.mediaUrl || exercise.mediaStorageId) && <ExerciseMedia exercise={exercise} compact className="mt-3 max-h-36 w-full" />}
                    {exercise && (exercise.weight || exercise.reps) && <p className="mt-3 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-bold text-emerald-300">{exercise.weight || exercise.reps}</p>}
                    {exercise?.notes && <div className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-right"><span className="block text-[9px] font-black text-amber-300">דגשי המאמן</span><p className="mt-0.5 text-sm text-white">{exercise.notes}</p></div>}
                  </div>
                  <div className="flex gap-1.5">{station?.exercises.map((_, index) => <span key={index} className={`h-1.5 flex-1 rounded-full ${index === exerciseSlot ? 'bg-indigo-400' : index < exerciseSlot ? 'bg-emerald-500' : 'bg-white/10'}`} />)}</div>
                </article>
              ))}
            </div>
          )}

          <div className="mt-5 flex items-center justify-center gap-3">
            <button onClick={previousStep} className="rounded-2xl bg-white/10 p-4"><ChevronRight size={28} /></button>
            <button onClick={() => { beep(); setIsRunning(value => !value); }} disabled={phase === 'COMPLETE'} className={`flex h-20 w-20 items-center justify-center rounded-full shadow-2xl disabled:opacity-40 ${isRunning ? 'bg-amber-400 text-slate-950' : 'bg-emerald-500'}`}>{isRunning ? <Pause size={38} fill="currentColor" /> : <Play size={38} fill="currentColor" />}</button>
            <button onClick={advanceStep} className="rounded-2xl bg-white/10 p-4"><ChevronLeft size={28} /></button>
            <button onClick={resetWorkout} className="mr-2 rounded-2xl bg-white/10 p-4"><RotateCcw size={25} /></button>
            <button onClick={() => beep()} className="rounded-2xl bg-white/10 p-4"><Volume2 size={25} /></button>
          </div>
        </section>
      </div>
    </main>
  );
};
