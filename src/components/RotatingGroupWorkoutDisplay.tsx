import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize, Pause, Play, RotateCcw, Volume2, X } from 'lucide-react';
import { GroupWorkoutProgram } from '../types';
import { ExerciseMedia } from './ExerciseMedia';
import { LiveClock } from './LiveClock';
import { RubisLogo } from './RubisLogo';
import { publishGroupWorkoutStatus, subscribeToGroupWorkoutCommands } from '../data/groupWorkoutRemote';

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
  const lastRemoteCommandIdRef = useRef('');

  const totalSteps = Math.max(1, stations.length * roundsPerStation * maxExercises);
  const completedSteps = rotationIndex * roundsPerStation * maxExercises + (chainRound - 1) * maxExercises + exerciseSlot;
  const progress = phase === 'COMPLETE' ? 100 : Math.min(100, (completedSteps / totalSteps) * 100);
  const assignments = useMemo(() => {
    const configuredParticipants = program.participants || [];
    const participants = configuredParticipants.length > 0
      ? configuredParticipants
      : stations.map((_, groupIndex) => ({ id: `placeholder-${groupIndex}`, name: (program.participantGroupNames || [])[groupIndex] || `קבוצה ${groupIndex + 1}`, groupIndex }));
    return participants.map(participant => {
      const groupIndex = Math.min(Math.max(0, participant.groupIndex), Math.max(0, stations.length - 1));
      const membersInGroup = participants.filter(member => member.groupIndex === groupIndex);
      const participantOffset = Math.max(0, membersInGroup.findIndex(member => member.id === participant.id));
      const stationIndex = stations.length ? (groupIndex + rotationIndex) % stations.length : 0;
      const station = stations[stationIndex];
      const activeExerciseIndex = station?.exercises.length ? (exerciseSlot + participantOffset) % station.exercises.length : 0;
      const nextExerciseIndex = station?.exercises.length ? (activeExerciseIndex + 1) % station.exercises.length : 0;
      return {
        participant,
        groupIndex,
        groupName: (program.participantGroupNames || [])[groupIndex] || `קבוצה ${groupIndex + 1}`,
        station,
        stationIndex,
        activeExerciseIndex,
        exercise: station?.exercises[activeExerciseIndex],
        nextExercise: station?.exercises[nextExerciseIndex]
      };
    });
  }, [exerciseSlot, program.participantGroupNames, program.participants, rotationIndex, stations]);

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

  useEffect(() => publishGroupWorkoutStatus({
    programId: program.id,
    phase,
    isRunning,
    secondsLeft,
    rotationIndex,
    chainRound,
    exerciseSlot,
    updatedAt: new Date().toISOString()
  }), [chainRound, exerciseSlot, isRunning, phase, program.id, rotationIndex, secondsLeft]);

  useEffect(() => subscribeToGroupWorkoutCommands(program.id, command => {
    if (command.id === lastRemoteCommandIdRef.current) return;
    lastRemoteCommandIdRef.current = command.id;
    if (command.action === 'PAUSE') setIsRunning(false);
    else if (command.action === 'RESUME' && phase !== 'COMPLETE') setIsRunning(true);
    else if (command.action === 'ADD_REST' && (phase === 'REST' || phase === 'TRANSITION')) setSecondsLeft(value => value + (command.seconds || 10));
    else if (command.action === 'NEXT_STEP') advancePhase();
    else if (command.action === 'RESET') resetWorkout();
  }), [chainRound, exerciseSlot, phase, program.id, rotationIndex]);

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
    return <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-center text-white" dir="rtl"><div><RubisLogo size={190} className="mx-auto mb-6" /><h1 className="text-3xl font-black">לא הוגדרו תחנות ותרגילים</h1><button onClick={exitDisplay} className="mt-6 rounded-xl bg-white px-5 py-3 font-black text-slate-900">חזרה למערכת</button></div></main>;
  }

  const phaseLabel = phase === 'WORK' ? 'עבודה' : phase === 'REST' ? 'מנוחה' : phase === 'TRANSITION' ? 'החלפת תחנות' : phase === 'COMPLETE' ? 'האימון הושלם!' : 'מתכוננים';
  const phaseColors = phase === 'WORK' ? 'from-emerald-500 to-green-600' : phase === 'REST' ? 'from-amber-400 to-orange-500 text-slate-950' : phase === 'TRANSITION' ? 'from-fuchsia-500 to-violet-600' : phase === 'COMPLETE' ? 'from-indigo-500 to-violet-600' : 'from-sky-500 to-blue-600';
  const groupIndexes: number[] = Array.from(new Set<number>(assignments.map(assignment => Number(assignment.groupIndex))));

  return (
    <main className="h-screen overflow-hidden bg-slate-950 text-white" dir="rtl">
      <div className="flex h-screen min-h-0 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-2 lg:px-6">
          <div className="flex items-center gap-4"><RubisLogo size={105} /><div><p className="text-sm font-black text-indigo-300">{program.groupName} · {(program.participants || []).length || program.participantCount || 0} משתתפים</p><h1 className="text-xl font-black lg:text-2xl">{program.title}</h1></div></div>
          <div className="flex items-center gap-2"><span className="hidden rounded-lg bg-white/5 px-3 py-2 text-xs text-slate-400 sm:block">סבב {chainRound}/{roundsPerStation} · החלפה {rotationIndex + 1}/{stations.length}</span><button onClick={() => void (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen())} className="rounded-lg bg-white/10 p-2.5"><Maximize size={20} /></button><button onClick={exitDisplay} className="rounded-lg bg-white/10 p-2.5"><X size={20} /></button></div>
        </header>
        <div className="h-1.5 shrink-0 bg-slate-800"><div className="h-full bg-gradient-to-l from-indigo-400 to-emerald-400 transition-all" style={{ width: `${progress}%` }} /></div>

        <section className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="flex min-h-0 flex-col overflow-hidden p-3">
            <div className="mb-2 flex shrink-0 items-center justify-center gap-4 text-center">
              <span className={`rounded-full bg-gradient-to-l px-6 py-1.5 text-lg font-black ${phaseColors}`}>{phaseLabel}</span>
              <div className={`font-mono text-[clamp(3.25rem,8vh,5.5rem)] font-black leading-none tabular-nums ${secondsLeft <= 3 && phase !== 'COMPLETE' ? 'animate-pulse text-red-400' : ''}`}>{formatTime(secondsLeft)}</div>
              {phase === 'TRANSITION' && <p className="text-xl font-black text-fuchsia-300">עוברים לתחנה הבאה ←</p>}
            </div>

            {phase === 'COMPLETE' ? <div className="flex min-h-0 flex-1 flex-col items-center justify-center"><div className="text-7xl">🏆</div><h2 className="mt-4 text-5xl font-black">כל הכבוד לכולם!</h2></div> :
            <div className={`grid min-h-0 flex-1 gap-2 ${stations.length <= 2 ? 'lg:grid-cols-2' : 'lg:grid-cols-3'}`}>
              {stations.map((station, stationIndex) => {
                const stationAssignments = assignments.filter(assignment => assignment.station?.id === station.id);
                const assignedGroupNames = Array.from(new Set(stationAssignments.map(assignment => assignment.groupName)));
                return (
                  <article key={station.id} className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900/80 p-2.5 shadow-xl">
                    <div className="mb-2 flex shrink-0 items-center justify-between gap-2"><div><h2 className="text-lg font-black text-white">{station.name}</h2><p className="text-xs font-bold text-indigo-300">{assignedGroupNames.join(', ') || 'ללא קבוצה'}</p></div><span className="rounded-lg bg-indigo-500/20 px-2 py-1 text-xs font-black text-indigo-200">בלוק {stationIndex + 1}</span></div>
                    <div className="grid min-h-0 flex-1 grid-cols-2 gap-2" style={{ gridTemplateRows: `repeat(${Math.ceil(Math.max(1, station.exercises.length) / 2)}, minmax(0, 1fr))` }}>
                      {station.exercises.map((exercise, exerciseIndex) => {
                        const activeParticipants = stationAssignments.filter(assignment => assignment.activeExerciseIndex === exerciseIndex);
                        const isActive = activeParticipants.length > 0;
                        return (
                          <div key={exercise.id} className={`flex min-h-0 flex-col overflow-hidden rounded-xl border p-2 transition ${isActive ? 'border-emerald-400 bg-emerald-500/15 shadow-[0_0_20px_rgba(52,211,153,0.12)]' : 'border-white/10 bg-white/5'}`}>
                            <div className="flex shrink-0 items-start gap-2"><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black ${isActive ? 'bg-emerald-500 text-slate-950' : 'bg-white/10 text-slate-300'}`}>{exerciseIndex + 1}</span><div className="min-w-0 flex-1"><h3 className="truncate text-base font-black text-white 2xl:text-lg">{exercise.name}</h3><p className="truncate text-xs text-slate-300">{exercise.weight || exercise.reps}</p></div></div>
                            {(exercise.mediaUrl || exercise.mediaStorageId) && <ExerciseMedia exercise={exercise} compact className="mt-1 min-h-0 max-h-[7vh] w-full flex-1" />}
                            {exercise.notes && <p className="mt-1 line-clamp-1 shrink-0 text-xs text-amber-200">דגש: {exercise.notes}</p>}
                            <div className="mt-1 flex min-h-6 shrink-0 flex-wrap gap-1">{activeParticipants.map(assignment => <span key={assignment.participant.id} className="rounded-full bg-emerald-400 px-2 py-1 text-xs font-black text-slate-950">{assignment.participant.name}</span>)}{!isActive && <span className="text-xs text-slate-600">פנוי כרגע</span>}</div>
                          </div>
                        );
                      })}
                    </div>
                  </article>
                );
              })}
            </div>}

            <div className="mt-2 flex shrink-0 items-center justify-center gap-2">
              <button onClick={previousStep} className="rounded-xl bg-white/10 p-2.5"><ChevronRight size={24} /></button>
              <button onClick={() => { beep(); setIsRunning(value => !value); }} disabled={phase === 'COMPLETE'} className={`flex h-14 w-14 items-center justify-center rounded-full shadow-2xl disabled:opacity-40 ${isRunning ? 'bg-amber-400 text-slate-950' : 'bg-emerald-500'}`}>{isRunning ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" />}</button>
              <button onClick={advanceStep} className="rounded-xl bg-white/10 p-2.5"><ChevronLeft size={24} /></button>
              <button onClick={resetWorkout} className="mr-1 rounded-xl bg-white/10 p-2.5"><RotateCcw size={21} /></button>
              <button onClick={() => beep()} className="rounded-xl bg-white/10 p-2.5"><Volume2 size={21} /></button>
            </div>
          </div>

          <aside className="hidden min-h-0 overflow-hidden border-r border-white/10 bg-slate-900/80 p-3 lg:flex lg:flex-col">
            <div className="mb-3 flex shrink-0 items-center justify-between gap-2"><h2 className="text-lg font-black">קבוצות ומתאמנים</h2><LiveClock className="shrink-0" /></div>
            <div className="grid min-h-0 flex-1 gap-2" style={{ gridTemplateRows: `repeat(${Math.max(1, groupIndexes.length)}, minmax(0, 1fr))` }}>
              {groupIndexes.map(groupIndex => {
                const members = assignments.filter(assignment => assignment.groupIndex === groupIndex);
                const groupName = members[0]?.groupName || `קבוצה ${groupIndex + 1}`;
                const stationName = members[0]?.station?.name || 'בהמתנה';
                return <section key={groupIndex} className="min-h-0 overflow-hidden rounded-xl border border-indigo-400/20 bg-indigo-500/10 p-2.5">
                  <div className="flex items-center justify-between gap-2"><h3 className="truncate text-base font-black text-indigo-200">{groupName}</h3><span className="truncate text-xs font-bold text-emerald-300">{stationName}</span></div>
                  <div className="mt-2 grid gap-1">
                    {members.map(({ participant, exercise, nextExercise }) => <div key={participant.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-950/50 px-2 py-1.5"><strong className="truncate text-sm text-white">{participant.name}</strong><span className="min-w-0 truncate text-xs font-bold text-emerald-300">{exercise?.name || 'המתנה'}{phase === 'REST' && nextExercise ? ` ← ${nextExercise.name}` : ''}</span></div>)}
                  </div>
                </section>;
              })}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
};
