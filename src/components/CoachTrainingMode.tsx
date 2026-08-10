import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Clock3, FastForward, MonitorPlay, Pause, Play, RotateCcw, UsersRound } from 'lucide-react';
import { GroupWorkoutLiveStatus, getGroupWorkoutStatus, sendGroupWorkoutCommand, subscribeToGroupWorkoutStatus } from '../data/groupWorkoutRemote';
import { GroupWorkoutProgram, TrainingSession, User, UserRole, WorkoutPlan } from '../types';
import { activateClubDisplay, clubDisplayUrl } from '../data/clubDisplayRemote';

interface CoachTrainingModeProps {
  activeUser: User;
  users: User[];
  sessions: TrainingSession[];
  workoutPlans: WorkoutPlan[];
  onUpdateWorkoutPlans: (plans: WorkoutPlan[]) => void;
  groupWorkoutPrograms: GroupWorkoutProgram[];
  onUpdateGroupWorkoutPrograms: (programs: GroupWorkoutProgram[]) => void;
  onOpenProgram: (session: TrainingSession) => void;
}

const sessionDateTime = (session: TrainingSession) => new Date(`${session.date}T${session.time}:00`);
const formatTimer = (seconds: number) => `${String(Math.floor(Math.max(0, seconds) / 60)).padStart(2, '0')}:${String(Math.max(0, seconds) % 60).padStart(2, '0')}`;

const LiveControls: React.FC<{ program: GroupWorkoutProgram }> = ({ program }) => {
  const [status, setStatus] = useState<GroupWorkoutLiveStatus | undefined>(() => getGroupWorkoutStatus(program.id));

  useEffect(() => {
    setStatus(getGroupWorkoutStatus(program.id));
    return subscribeToGroupWorkoutStatus(program.id, setStatus);
  }, [program.id]);

  const restartWorkout = () => {
    sendGroupWorkoutCommand(program.id, 'RESET');
    window.setTimeout(() => sendGroupWorkoutCommand(program.id, 'RESUME'), 150);
  };

  return <div className="rounded-2xl border border-indigo-200 bg-slate-950 p-3 text-white">
    <div className="mb-3 flex items-center justify-between gap-2"><div><p className="text-[10px] font-black text-indigo-300">שלט למסך</p><p className="text-sm font-black">{status ? `${status.phase === 'WORK' ? 'עבודה' : status.phase === 'REST' ? 'מנוחה' : status.phase === 'TRANSITION' ? 'מעבר' : status.phase === 'COMPLETE' ? 'הושלם' : 'הכנה'} · ${formatTimer(status.secondsLeft)}` : 'פתח את מסך האימון לחיבור'}</p></div><span className={`h-2.5 w-2.5 rounded-full ${status ? 'bg-emerald-400' : 'bg-slate-600'}`} /></div>
    <div className="grid grid-cols-2 gap-2">
      <button onClick={() => sendGroupWorkoutCommand(program.id, 'PAUSE')} disabled={!status?.isRunning} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-amber-400 px-3 py-2 text-xs font-black text-slate-950 disabled:opacity-35"><Pause size={15} fill="currentColor" /> עצירה</button>
      <button onClick={() => sendGroupWorkoutCommand(program.id, 'RESUME')} disabled={!status || status.isRunning || status.phase === 'COMPLETE'} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-black disabled:opacity-35"><Play size={15} fill="currentColor" /> המשך</button>
      <button onClick={restartWorkout} disabled={!status} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-red-500 px-3 py-2 text-xs font-black disabled:opacity-35"><RotateCcw size={15} /> הפעלה מחדש</button>
      <button onClick={() => sendGroupWorkoutCommand(program.id, 'NEXT_STEP')} disabled={!status || status.phase === 'COMPLETE'} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-indigo-500 px-3 py-2 text-xs font-black disabled:opacity-35"><FastForward size={15} /> השלב הבא</button>
      <button onClick={() => sendGroupWorkoutCommand(program.id, 'ADD_REST', 10)} disabled={!status || !['REST', 'TRANSITION'].includes(status.phase)} className="col-span-2 min-h-11 rounded-xl bg-white/10 px-3 py-2 text-xs font-black disabled:opacity-35">+10 שניות למנוחה</button>
    </div>
  </div>;
};

export const CoachTrainingMode: React.FC<CoachTrainingModeProps> = ({ activeUser, users, sessions, workoutPlans, onUpdateWorkoutPlans, groupWorkoutPrograms, onUpdateGroupWorkoutPrograms, onOpenProgram }) => {
  const [selectedLibraryItems, setSelectedLibraryItems] = useState<Record<string, string>>({});
  const [scheduleView, setScheduleView] = useState<'DAY' | 'WEEK'>('DAY');
  const [selectedScheduleDate, setSelectedScheduleDate] = useState(() => new Date().toISOString().split('T')[0]);
  const relevantSessions = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return sessions.filter(session => {
      const date = sessionDateTime(session);
      return date >= start && date < end;
    }).sort((a, b) => sessionDateTime(a).getTime() - sessionDateTime(b).getTime());
  }, [sessions]);
  const displayedSessions = scheduleView === 'WEEK'
    ? relevantSessions
    : relevantSessions.filter(session => session.date === selectedScheduleDate);

  const openGroupDisplay = async (program: GroupWorkoutProgram) => {
    try {
      await activateClubDisplay(program);
      window.alert('האימון נשלח למסך המועדון הקבוע.');
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'לא ניתן להפעיל את מסך המועדון.');
    }
  };

  const personalLibrary = useMemo(() => workoutPlans.filter(plan => !plan.sessionId && plan.exercises.length > 0), [workoutPlans]);
  const groupLibrary = useMemo(() => groupWorkoutPrograms.filter(program => !program.sessionId), [groupWorkoutPrograms]);

  const assignPersonalPlan = (session: TrainingSession, traineeId: string) => {
    const sourceId = selectedLibraryItems[session.id] || personalLibrary[0]?.id;
    const source = personalLibrary.find(plan => plan.id === sourceId);
    if (!source || !traineeId) return;
    const stamp = Date.now();
    const assigned: WorkoutPlan = {
      ...source,
      id: `session-plan-${stamp}`,
      title: source.title || `תוכנית של ${users.find(user => user.id === source.traineeId)?.name || 'מתאמן'}`,
      traineeId,
      sessionId: session.id,
      sourcePlanId: source.id,
      coachId: activeUser.id,
      coachName: activeUser.name,
      lastUpdated: new Date().toISOString().split('T')[0],
      exercises: source.exercises.map((exercise, index) => ({ ...exercise, id: `session-exercise-${stamp}-${index}` }))
    };
    onUpdateWorkoutPlans([assigned, ...workoutPlans.filter(plan => plan.sessionId !== session.id)]);
  };

  const assignGroupPlan = (session: TrainingSession) => {
    const sourceId = selectedLibraryItems[session.id] || groupLibrary[0]?.id;
    const source = groupLibrary.find(program => program.id === sourceId);
    if (!source) return;
    const stamp = Date.now();
    const stationCount = Math.max(1, (source.stations || []).length);
    const participants = session.registeredUsers.map((userId, index) => ({
      id: userId,
      name: users.find(user => user.id === userId)?.name || `מתאמן ${index + 1}`,
      groupIndex: index % stationCount
    }));
    const assigned: GroupWorkoutProgram = {
      ...source,
      id: `group-program-${stamp}`,
      sessionId: session.id,
      sessionDate: session.date,
      sessionTime: session.time,
      groupName: session.title,
      coachId: activeUser.id,
      coachName: activeUser.name,
      exercises: source.exercises.map((exercise, index) => ({ ...exercise, id: `group-exercise-${stamp}-${index}` })),
      stations: (source.stations || []).map((station, stationIndex) => ({
        ...station,
        id: `group-station-${stamp}-${stationIndex}`,
        exercises: station.exercises.map((exercise, exerciseIndex) => ({ ...exercise, id: `group-station-exercise-${stamp}-${stationIndex}-${exerciseIndex}` }))
      })),
      participants,
      participantCount: participants.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      publishedAt: source.status === 'PUBLISHED' ? new Date().toISOString() : undefined
    };
    onUpdateGroupWorkoutPrograms([assigned, ...groupWorkoutPrograms.filter(program => program.sessionId !== session.id)]);
  };

  const updateParticipantGroup = (program: GroupWorkoutProgram, participantId: string, groupIndex: number) => {
    onUpdateGroupWorkoutPrograms(groupWorkoutPrograms.map(item => item.id === program.id ? {
      ...item,
      participants: (item.participants || []).map(participant => participant.id === participantId ? { ...participant, groupIndex } : participant),
      updatedAt: new Date().toISOString()
    } : item));
  };

  return <section className="space-y-3 p-3 sm:p-5" dir="rtl">
    <div className="rounded-2xl bg-gradient-to-l from-slate-950 to-indigo-950 p-4 text-white">
      <div className="flex items-center gap-2"><CalendarDays className="text-indigo-300" size={20} /><h2 className="text-xl font-black">לוח האימונים של המועדון</h2></div>
      <p className="mt-1 text-xs text-slate-300">כל האימונים, התוכניות והשליטה במסך במקום אחד</p>
      <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-white/10 p-1">
        <button type="button" onClick={() => setScheduleView('DAY')} className={`min-h-10 rounded-lg text-xs font-black ${scheduleView === 'DAY' ? 'bg-white text-slate-950' : 'text-white'}`}>תצוגה יומית</button>
        <button type="button" onClick={() => setScheduleView('WEEK')} className={`min-h-10 rounded-lg text-xs font-black ${scheduleView === 'WEEK' ? 'bg-white text-slate-950' : 'text-white'}`}>תצוגה שבועית</button>
      </div>
      {scheduleView === 'DAY' && <input type="date" value={selectedScheduleDate} onChange={event => setSelectedScheduleDate(event.target.value)} className="mt-3 min-h-11 w-full rounded-xl border border-white/20 bg-white px-3 font-bold text-slate-900" aria-label="בחירת יום להצגת אימונים" />}
    </div>
    {displayedSessions.map(session => {
      const program = groupWorkoutPrograms.find(item => item.sessionId === session.id);
      const traineeId = session.targetTraineeId || session.registeredUsers[0] || session.coTrainees?.[0];
      const trainee = users.find(user => user.id === traineeId);
      const personalPlan = workoutPlans.find(plan => plan.sessionId === session.id)
        || workoutPlans.find(plan => plan.traineeId === traineeId && !plan.sessionId);
      return <article key={session.id} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2 text-[10px] font-black"><span className={`rounded-full px-2 py-1 ${session.isPersonalTraining ? 'bg-sky-100 text-sky-800' : 'bg-indigo-100 text-indigo-800'}`}>{session.isPersonalTraining ? 'אישי' : 'קבוצתי'}</span><span className="flex items-center gap-1 text-slate-500"><Clock3 size={12} /> {session.date} · {session.time}</span></div><h3 className="mt-2 truncate text-lg font-black text-slate-900">{session.title}</h3><p className="mt-1 text-xs text-slate-500">{session.isPersonalTraining ? trainee?.name || 'מתאמן טרם שובץ' : `${session.registeredUsers.length}/${session.maxParticipants} נרשמים`}</p></div><button onClick={() => onOpenProgram(session)} className="shrink-0 rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-700">תכנון / עריכה</button></div>

        {session.isPersonalTraining ? <div className="mt-3 space-y-3 rounded-xl border border-sky-100 bg-sky-50 p-3">
          <p className="text-xs font-black text-sky-900">{personalPlan ? `${personalPlan.exercises.length} תרגילים בתוכנית המשובצת` : 'עדיין לא שובצה תוכנית לאימון הזה'}</p>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <select value={selectedLibraryItems[session.id] || personalLibrary[0]?.id || ''} onChange={event => setSelectedLibraryItems(current => ({ ...current, [session.id]: event.target.value }))} disabled={!traineeId || personalLibrary.length === 0} className="min-h-11 rounded-xl border border-sky-200 bg-white px-3 text-xs font-bold text-slate-800 disabled:opacity-50">
              {personalLibrary.length === 0 && <option value="">אין עדיין תוכניות אישיות במאגר</option>}
              {personalLibrary.map(plan => <option key={plan.id} value={plan.id}>{plan.title || `תוכנית של ${users.find(user => user.id === plan.traineeId)?.name || 'מתאמן'}`} · {plan.exercises.length} תרגילים</option>)}
            </select>
            <button onClick={() => traineeId && assignPersonalPlan(session, traineeId)} disabled={!traineeId || personalLibrary.length === 0} className="min-h-11 rounded-xl bg-sky-700 px-4 py-2 text-xs font-black text-white disabled:opacity-40">{workoutPlans.some(plan => plan.sessionId === session.id) ? 'החלף תוכנית' : 'שבץ מהמאגר'}</button>
          </div>
          {personalPlan && <button onClick={() => window.open(`${window.location.origin}${window.location.pathname}#personal-workout-display=${encodeURIComponent(personalPlan.id)}`, '_blank', 'noopener,noreferrer')} className="flex w-full min-h-11 items-center justify-center gap-2 rounded-xl bg-sky-600 px-3 py-2 text-xs font-black text-white"><MonitorPlay size={16} /> פתח תצוגת אימון</button>}
        </div> : <>
          {program ? <div className="mt-3 space-y-3">
            <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3"><div className="flex items-center justify-between gap-2"><div><p className="text-xs font-black text-indigo-900">{program.title}</p><p className="mt-1 text-[10px] text-indigo-700">{program.mode === 'ROTATING_GROUPS' ? `${(program.stations || []).length} קבוצות · ${(program.stations || []).reduce((sum, station) => sum + station.exercises.length, 0)} תרגילים` : `${program.exercises.length} תרגילים`}</p></div><button onClick={() => void openGroupDisplay(program)} disabled={program.status !== 'PUBLISHED'} className="flex min-h-11 items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-black text-white disabled:opacity-40"><MonitorPlay size={15} /> הצג במסך המועדון</button></div><a href={clubDisplayUrl()} target="_blank" rel="noreferrer" className="mt-2 block text-left text-[10px] font-bold text-indigo-700 underline">פתח את כתובת המסך הקבועה במחשב זה</a></div>
            {program.mode === 'ROTATING_GROUPS' && (program.participants || []).length > 0 && <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3"><div className="mb-2 flex items-center gap-2"><UsersRound size={15} className="text-emerald-700" /><p className="text-xs font-black text-emerald-900">שיבוץ מהיר לקבוצות</p></div><div className="space-y-2">{(program.participants || []).map(participant => <div key={participant.id} className="rounded-xl bg-white p-2"><strong className="block truncate text-xs text-slate-800">{participant.name}</strong><div className="mt-2 grid grid-cols-2 gap-1.5">{(program.stations || []).map((station, index) => <button key={station.id} onClick={() => updateParticipantGroup(program, participant.id, index)} className={`rounded-lg px-2 py-2 text-[10px] font-black ${participant.groupIndex === index ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{(program.participantGroupNames || [])[index] || `קבוצה ${index + 1}`}</button>)}</div></div>)}</div></div>}
            <div className="grid gap-2 rounded-xl border border-indigo-100 bg-white p-3 sm:grid-cols-[1fr_auto]">
              <select value={selectedLibraryItems[session.id] || groupLibrary[0]?.id || ''} onChange={event => setSelectedLibraryItems(current => ({ ...current, [session.id]: event.target.value }))} disabled={groupLibrary.length === 0} className="min-h-11 rounded-xl border border-indigo-200 bg-white px-3 text-xs font-bold text-slate-800 disabled:opacity-50">
                {groupLibrary.length === 0 && <option value="">אין עדיין תוכניות קבוצתיות במאגר</option>}
                {groupLibrary.map(item => <option key={item.id} value={item.id}>{item.title} · {item.mode === 'ROTATING_GROUPS' ? (item.stations || []).reduce((sum, station) => sum + station.exercises.length, 0) : item.exercises.length} תרגילים</option>)}
              </select>
              <button onClick={() => assignGroupPlan(session)} disabled={groupLibrary.length === 0} className="min-h-11 rounded-xl bg-indigo-700 px-4 py-2 text-xs font-black text-white disabled:opacity-40">החלף מהמאגר</button>
            </div>
            <LiveControls program={program} />
          </div> : <button onClick={() => onOpenProgram(session)} className="mt-3 w-full min-h-12 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-black text-white">צור או שבץ תוכנית לאימון</button>}
          {!program && <div className="mt-2 grid gap-2 rounded-xl border border-indigo-100 bg-indigo-50 p-3 sm:grid-cols-[1fr_auto]">
            <select value={selectedLibraryItems[session.id] || groupLibrary[0]?.id || ''} onChange={event => setSelectedLibraryItems(current => ({ ...current, [session.id]: event.target.value }))} disabled={groupLibrary.length === 0} className="min-h-11 rounded-xl border border-indigo-200 bg-white px-3 text-xs font-bold text-slate-800 disabled:opacity-50">
              {groupLibrary.length === 0 && <option value="">אין תוכניות במאגר — יש ליצור במצב תכנון</option>}
              {groupLibrary.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
            <button onClick={() => assignGroupPlan(session)} disabled={groupLibrary.length === 0} className="min-h-11 rounded-xl bg-indigo-700 px-4 py-2 text-xs font-black text-white disabled:opacity-40">שבץ מהמאגר</button>
          </div>}
        </>}
      </article>;
    })}
    {displayedSessions.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center"><CalendarDays className="mx-auto text-slate-300" size={34} /><p className="mt-3 text-sm font-black text-slate-600">אין אימונים במועד שנבחר</p></div>}
  </section>;
};
