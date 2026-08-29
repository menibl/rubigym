/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  User,
  UserRole,
  MuscleGroup,
  Gender,
  MembershipType,
  WorkoutPlan,
  GroupWorkoutProgram
} from '../types';
import { X, Calendar, Clock, Users, Plus, Dumbbell, Sparkles, Repeat, ShieldCheck } from 'lucide-react';
import { SessionMembershipSelector } from './SessionMembershipSelector';

export interface CreateSessionData {
  title: string;
  date: string;
  time: string;
  durationMinutes: number;
  coachId: string;
  muscleGroup: MuscleGroup;
  maxParticipants: number;
  ageMin?: number;
  ageMax?: number;
  genderRestriction: Gender;
  allowedMemberships: MembershipType[];
  category: 'GROUP' | 'PERSONAL' | 'OPEN_GYM';
  recurringType: 'NONE' | 'WEEKLY_UNLIMITED' | 'WEEKLY_UNTIL_DATE';
  recurringUntilDate?: string;
  targetTraineeId?: string;
  isDemoSession?: boolean;
  demoTraineeName?: string;
  selectedProgramId?: string;
}

function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addMinutesToTime(time: string, durationMinutes: number): string {
  const [hours, minutes] = time.split(':').map(Number);
  const totalMinutes = (hours * 60) + minutes + durationMinutes;
  const endHours = Math.floor(totalMinutes / 60) % 24;
  const endMinutes = totalMinutes % 60;
  return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
}

function isValidClubStartTime(time: string): boolean {
  const match = time.match(/^(\d{2}):(\d{2})$/);
  if (!match) return false;
  const totalMinutes = Number(match[1]) * 60 + Number(match[2]);
  return totalMinutes >= 6 * 60 && totalMinutes <= 22 * 60 && Number(match[2]) % 15 === 0;
}

export function createSessionsFromData(
  data: CreateSessionData,
  users: User[],
  activeUser: User
) {
  const seriesId = `series-${Date.now()}`;
  let targetDates: string[] = [];

  if (data.recurringType === 'NONE') {
    targetDates = [data.date];
  } else if (data.recurringType === 'WEEKLY_UNLIMITED') {
    // Generate weekly sessions for 52 weeks (1 year) using pure local date arithmetic
    const parts = data.date.split('-');
    const startDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    for (let i = 0; i < 52; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + (i * 7));
      targetDates.push(formatLocalDate(d));
    }
  } else if (data.recurringType === 'WEEKLY_UNTIL_DATE' && data.recurringUntilDate) {
    const parts = data.date.split('-');
    const startDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    const endParts = data.recurringUntilDate.split('-');
    const endDate = new Date(Number(endParts[0]), Number(endParts[1]) - 1, Number(endParts[2]), 23, 59, 59);

    let curr = new Date(startDate);
    let count = 0;
    while (curr <= endDate && count < 52) {
      targetDates.push(formatLocalDate(curr));
      curr.setDate(curr.getDate() + 7);
      count++;
    }
  }

  if (targetDates.length === 0) {
    targetDates = [data.date];
  }

  const isSeries = targetDates.length > 1;

  if (data.category === 'OPEN_GYM') {
    const durationMinutes = Math.max(15, Number(data.durationMinutes) || 60);
    const timeSlotStr = `${data.time} - ${addMinutesToTime(data.time, durationMinutes)}`;
    
    const newOpenGym = targetDates.map((dStr, idx) => ({
      id: `open-${Date.now()}-${idx}`,
      date: dStr,
      timeSlot: timeSlotStr,
      maxParticipants: data.maxParticipants || 15,
      registeredUsers: [],
      waitlistUsers: [],
      recurringType: isSeries ? data.recurringType : ('NONE' as const),
      recurringUntilDate: isSeries ? data.recurringUntilDate : undefined,
      seriesId: isSeries ? seriesId : undefined
    }));

    return { newSessions: [], newOpenGym };
  } else {
    const coach = users.find(u => u.id === data.coachId) || activeUser;
    
    const newSessions = targetDates.map((dStr, idx) => ({
      id: `session-${Date.now()}-${idx}`,
      title: data.title,
      date: dStr,
      time: data.time,
      durationMinutes: data.durationMinutes,
      coachId: coach.id,
      coachName: coach.name,
      muscleGroup: data.muscleGroup,
      maxParticipants: data.maxParticipants,
      ageMin: data.ageMin,
      ageMax: data.ageMax,
      genderRestriction: data.genderRestriction,
      allowedMemberships: data.allowedMemberships,
      isPersonalTraining: data.category === 'PERSONAL',
      targetTraineeId: data.category === 'PERSONAL' ? data.targetTraineeId : undefined,
      isDemoSession: data.category === 'PERSONAL' ? data.isDemoSession : undefined,
      demoTraineeName: data.category === 'PERSONAL' && data.isDemoSession ? data.demoTraineeName?.trim() : undefined,
      coTrainees: data.category === 'PERSONAL' && data.targetTraineeId ? [data.targetTraineeId] : undefined,
      registeredUsers: [],
      waitlistUsers: [],
      recurringType: isSeries ? data.recurringType : ('NONE' as const),
      recurringUntilDate: isSeries ? data.recurringUntilDate : undefined,
      seriesId: isSeries ? seriesId : undefined
    }));

    return { newSessions, newOpenGym: [] };
  }
}

interface CreateSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeUser: User;
  users: User[];
  initialDate?: string;
  initialTime?: string;
  onCreateSession: (data: CreateSessionData) => void;
  workoutPlans?: WorkoutPlan[];
  groupWorkoutPrograms?: GroupWorkoutProgram[];
}

export const CreateSessionModal: React.FC<CreateSessionModalProps> = ({
  isOpen,
  onClose,
  activeUser,
  users,
  initialDate,
  initialTime,
  onCreateSession,
  workoutPlans = [],
  groupWorkoutPrograms = []
}) => {
  const [category, setCategory] = useState<'GROUP' | 'PERSONAL' | 'OPEN_GYM'>('GROUP');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('18:00');
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [coachId, setCoachId] = useState('');
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>(MuscleGroup.UPPER);
  const [maxParticipants, setMaxParticipants] = useState<number>(10);
  const [ageMin, setAgeMin] = useState<string>('');
  const [ageMax, setAgeMax] = useState<string>('');
  const [genderRestriction, setGenderRestriction] = useState<Gender>(Gender.ALL);
  const [allowedMemberships, setAllowedMemberships] = useState<MembershipType[]>([]);
  const [targetTraineeId, setTargetTraineeId] = useState('');
  const [isDemoSession, setIsDemoSession] = useState(false);
  const [demoTraineeName, setDemoTraineeName] = useState('');
  const [selectedProgramId, setSelectedProgramId] = useState('');

  // Recurrence state
  const [recurringType, setRecurringType] = useState<'NONE' | 'WEEKLY_UNLIMITED' | 'WEEKLY_UNTIL_DATE'>('NONE');
  const [recurringUntilDate, setRecurringUntilDate] = useState<string>('');

  // Update initial fields when modal opens or initialDate/initialTime changes
  useEffect(() => {
    if (isOpen) {
      const defaultDate = initialDate || new Date().toISOString().split('T')[0];
      const defaultTime = initialTime || '18:00';
      
      setDate(defaultDate);
      setTime(defaultTime);
      setCoachId(activeUser.id);
      setCategory('GROUP');
      setTitle('');
      setDurationMinutes(60);
      setMaxParticipants(10);
      setAgeMin('');
      setAgeMax('');
      setGenderRestriction(Gender.ALL);
      setAllowedMemberships([]);
      setRecurringType('NONE');
      setTargetTraineeId('');
      setIsDemoSession(false);
      setDemoTraineeName('');
      setSelectedProgramId('');

      // Default end date for until date (e.g., 1 month ahead)
      const oneMonthLater = new Date(defaultDate + 'T00:00:00');
      oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
      setRecurringUntilDate(oneMonthLater.toISOString().split('T')[0]);
    }
  }, [isOpen, initialDate, initialTime, activeUser.id]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (category !== 'OPEN_GYM' && !(category === 'PERSONAL' && isDemoSession) && allowedMemberships.length === 0) {
      alert('יש לבחור לפחות סוג מנוי אחד המורשה להירשם לאימון!');
      return;
    }

    if (!isValidClubStartTime(time)) {
      alert('יש לבחור שעת התחלה בין 06:00 ל־22:00, במרווחים של 15 דקות.');
      return;
    }

    if (category === 'PERSONAL' && selectedProgramId && !targetTraineeId && !isDemoSession) {
      alert('כדי לשבץ תוכנית אישית מהמאגר יש לבחור מתאמן.');
      return;
    }

    if (category === 'PERSONAL' && isDemoSession && !demoTraineeName.trim()) {
      alert('יש להזין את שם המתאמן באימון ההדגמה.');
      return;
    }

    if (recurringType === 'WEEKLY_UNTIL_DATE' && (!recurringUntilDate || recurringUntilDate <= date)) {
      alert('תאריך סיום המחזוריות חייב להיות מאוחר מתאריך התחלת האימון!');
      return;
    }

    const finalTitle = title.trim() || (
      category === 'PERSONAL' && isDemoSession ? `אימון הדגמה – ${demoTraineeName.trim()}` :
      category === 'PERSONAL' ? 'אימון אישי 1-על-1' :
      category === 'OPEN_GYM' ? 'Open Gym (שעות פתוחות)' :
      'אימון כושר קבוצתי'
    );

    onCreateSession({
      title: finalTitle,
      date,
      time,
      durationMinutes: Number(durationMinutes) || 60,
      coachId: coachId || activeUser.id,
      muscleGroup,
      maxParticipants: category === 'PERSONAL' ? (Number(maxParticipants) || 1) : Number(maxParticipants),
      ageMin: ageMin ? Number(ageMin) : undefined,
      ageMax: ageMax ? Number(ageMax) : undefined,
      genderRestriction,
      allowedMemberships,
      category,
      recurringType,
      recurringUntilDate: recurringType === 'WEEKLY_UNTIL_DATE' ? recurringUntilDate : undefined,
      targetTraineeId: category === 'PERSONAL' ? targetTraineeId || undefined : undefined,
      isDemoSession: category === 'PERSONAL' ? isDemoSession : undefined,
      demoTraineeName: category === 'PERSONAL' && isDemoSession ? demoTraineeName.trim() : undefined,
      selectedProgramId: category !== 'OPEN_GYM' ? selectedProgramId || undefined : undefined
    });

    onClose();
  };

  const coaches = users.filter(u => u.role === UserRole.COACH || u.role === UserRole.MANAGER);
  const trainees = users.filter(u => u.role === UserRole.TRAINEE);
  const availablePrograms = category === 'PERSONAL'
    ? workoutPlans.filter(plan => !plan.sessionId && plan.exercises.length > 0)
    : groupWorkoutPrograms.filter(program => !program.sessionId);

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-fade-in dir-rtl overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 relative my-auto max-h-[92vh] overflow-y-auto scrollbar-thin">
        {/* Close Button */}
        <button
          onClick={onClose}
          type="button"
          className="absolute top-4 left-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 mb-4">
          <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
            <Plus className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-slate-900">
              הגדרת אימון חדש ביומן
            </h2>
            <p className="text-xs text-slate-500">
              הגדרת שעות, מאמן אחראי ומחזוריות שבועית
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Category Tabs */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">
              סוג האימון:
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'GROUP', label: '👥 קבוצתי', desc: 'אימון רגיל רב-משתתפים' },
                { id: 'PERSONAL', label: '🏋️ אישי (PT)', desc: 'אימון אישי 1-על-1' },
                { id: 'OPEN_GYM', label: '🔓 Open Gym', desc: 'שעות פתוחות לאימון עצמאי' }
              ].map(cat => (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => {
                    const c = cat.id as any;
                    setCategory(c);
                    setSelectedProgramId('');
                    if (c === 'PERSONAL') {
                      setMaxParticipants(1);
                      if (!title) setTitle('אימון אישי');
                    } else if (c === 'OPEN_GYM') {
                      setIsDemoSession(false);
                      setDemoTraineeName('');
                      setMaxParticipants(15);
                      setDurationMinutes(60);
                      if (!title) setTitle('Open Gym');
                    }
                  }}
                  className={`p-2.5 rounded-xl text-xs font-bold transition text-right cursor-pointer border flex flex-col gap-0.5 ${
                    category === cat.id
                      ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span>{cat.label}</span>
                  <span className={`text-[10px] font-normal ${category === cat.id ? 'text-emerald-100' : 'text-slate-400'}`}>
                    {cat.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {category !== 'OPEN_GYM' && (
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-3.5">
              <div className="mb-2 flex items-center gap-2 text-xs font-extrabold text-indigo-950">
                <Dumbbell size={16} className="text-indigo-600" />
                <span>שיבוץ תוכנית מוכנה מהמאגר</span>
              </div>
              <div className={`grid gap-3 ${category === 'PERSONAL' ? 'sm:grid-cols-2' : ''}`}>
                {category === 'PERSONAL' && (
                  <div className="space-y-2">
                    <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 text-xs font-black text-amber-950">
                      <input type="checkbox" checked={isDemoSession} onChange={event => {
                        setIsDemoSession(event.target.checked);
                        if (event.target.checked) setTargetTraineeId('');
                      }} className="accent-amber-500" />
                      אימון הדגמה למתאמן שטרם נרשם
                    </label>
                    {isDemoSession ? <label className="block text-xs font-bold text-slate-700">שם המתאמן להדגמה
                      <input required value={demoTraineeName} onChange={event => setDemoTraineeName(event.target.value)} placeholder="שם פרטי ומשפחה" className="mt-1 w-full rounded-xl border border-indigo-200 bg-white px-3 py-2.5 text-xs" />
                    </label> : <label className="block text-xs font-bold text-slate-700">מתאמן לאימון האישי
                      <select value={targetTraineeId} onChange={event => setTargetTraineeId(event.target.value)} className="mt-1 w-full rounded-xl border border-indigo-200 bg-white px-3 py-2.5 text-xs">
                        <option value="">בחירת מתאמן...</option>
                        {trainees.map(trainee => <option key={trainee.id} value={trainee.id}>{trainee.name}</option>)}
                      </select>
                    </label>}
                  </div>
                )}
                <label className="text-xs font-bold text-slate-700">תוכנית מהמאגר
                  <select value={selectedProgramId} onChange={event => setSelectedProgramId(event.target.value)} className="mt-1 w-full rounded-xl border border-indigo-200 bg-white px-3 py-2.5 text-xs">
                    <option value="">ללא תוכנית — שיבוץ מאוחר יותר</option>
                    {availablePrograms.map(program => (
                      <option key={program.id} value={program.id}>
                        {'traineeId' in program
                          ? `${program.title || `תוכנית של ${users.find(user => user.id === program.traineeId)?.name || 'מתאמן'}`} · ${program.exercises.length} תרגילים`
                          : `${program.title} · ${program.mode === 'ROTATING_GROUPS' ? (program.stations || []).reduce((sum, station) => sum + station.exercises.length, 0) : program.exercises.length} תרגילים`}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="mt-2 text-[10px] leading-4 text-indigo-700">אם תיבחר תוכנית, ייווצר עותק נפרד ויישובץ אוטומטית לכל אירוע שייווצר ביומן. באימון הדגמה אין צורך בחשבון מתאמן.</p>
            </div>
          )}

          {/* Core Info Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <div className="sm:col-span-2 md:col-span-1">
              <label className="block text-xs text-slate-700 font-bold mb-1">
                שם האימון
              </label>
              <input
                type="text"
                required
                placeholder="לדוגמה: אימון אינטרוולים / PT"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full border border-slate-300 rounded-xl p-2.5 text-xs focus:outline-none focus:border-emerald-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-700 font-bold mb-1">
                מאמן אחראי
              </label>
              <select
                value={coachId}
                onChange={(e) => setCoachId(e.target.value)}
                className="w-full border border-slate-300 rounded-xl p-2.5 text-xs focus:outline-none focus:border-emerald-500 bg-white"
              >
                {coaches.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.role === UserRole.MANAGER ? 'מנהל ומאמן' : 'מאמן'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-700 font-bold mb-1">
                קבוצת שרירים / אזור
              </label>
              <select
                value={muscleGroup}
                onChange={(e) => setMuscleGroup(e.target.value as MuscleGroup)}
                className="w-full border border-slate-300 rounded-xl p-2.5 text-xs focus:outline-none focus:border-emerald-500 bg-white"
              >
                <option value={MuscleGroup.UPPER}>פלג גוף עליון</option>
                <option value={MuscleGroup.LEGS}>רגליים וישבן</option>
                <option value={MuscleGroup.BACK}>גב</option>
                <option value={MuscleGroup.SHOULDERS}>כתפיים</option>
                <option value={MuscleGroup.CORE}>בטן וליבה (Core)</option>
                <option value={MuscleGroup.FUNCTIONAL}>אימון פונקציונלי כללי</option>
              </select>
            </div>
          </div>

          {/* Date, Time, Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-700 font-bold mb-1">
                תאריך (תאריך התחלה)
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border border-slate-300 rounded-xl p-2.5 text-xs focus:outline-none focus:border-emerald-500 bg-white font-mono"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-700 font-bold mb-1">
                שעת התחלה
              </label>
              <input
                type="time"
                required
                min="06:00"
                max="22:00"
                step="900"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full border border-slate-300 rounded-xl p-2.5 text-xs focus:outline-none focus:border-emerald-500 bg-white font-mono"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-700 font-bold mb-1">
                משך זמן (דקות)
              </label>
              <input
                type="number"
                required
                min="15"
                max="180"
                step="15"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full border border-slate-300 rounded-xl p-2.5 text-xs focus:outline-none focus:border-emerald-500 bg-white"
              />
            </div>
          </div>

          {/* RECURRENCE SETTINGS (מחזוריות האימון) */}
          <div className="bg-amber-50/70 border border-amber-200/90 rounded-2xl p-3.5 space-y-2.5">
            <div className="flex items-center gap-2 text-amber-900 font-extrabold text-xs">
              <Repeat className="w-4 h-4 text-amber-600" />
              <span>הגדרת מחזוריות לאימון (תזמון חוזר)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <label className={`p-2.5 rounded-xl border text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
                recurringType === 'NONE'
                  ? 'bg-amber-600 text-white border-amber-700 shadow-2xs'
                  : 'bg-white text-slate-700 border-amber-200 hover:bg-amber-100/50'
              }`}>
                <input
                  type="radio"
                  name="recurringType"
                  checked={recurringType === 'NONE'}
                  onChange={() => setRecurringType('NONE')}
                  className="hidden"
                />
                <span>🟢 חד-פעמי</span>
              </label>

              <label className={`p-2.5 rounded-xl border text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
                recurringType === 'WEEKLY_UNLIMITED'
                  ? 'bg-amber-600 text-white border-amber-700 shadow-2xs'
                  : 'bg-white text-slate-700 border-amber-200 hover:bg-amber-100/50'
              }`}>
                <input
                  type="radio"
                  name="recurringType"
                  checked={recurringType === 'WEEKLY_UNLIMITED'}
                  onChange={() => setRecurringType('WEEKLY_UNLIMITED')}
                  className="hidden"
                />
                <span>🔁 כל שבוע (ללא הגבלה)</span>
              </label>

              <label className={`p-2.5 rounded-xl border text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
                recurringType === 'WEEKLY_UNTIL_DATE'
                  ? 'bg-amber-600 text-white border-amber-700 shadow-2xs'
                  : 'bg-white text-slate-700 border-amber-200 hover:bg-amber-100/50'
              }`}>
                <input
                  type="radio"
                  name="recurringType"
                  checked={recurringType === 'WEEKLY_UNTIL_DATE'}
                  onChange={() => setRecurringType('WEEKLY_UNTIL_DATE')}
                  className="hidden"
                />
                <span>📅 כל שבוע עד תאריך</span>
              </label>
            </div>

            {recurringType === 'WEEKLY_UNTIL_DATE' && (
              <div className="pt-2 border-t border-amber-200/60">
                <label className="block text-xs text-amber-950 font-bold mb-1">
                  תאריך סיום המחזוריות:
                </label>
                <input
                  type="date"
                  required
                  min={date}
                  value={recurringUntilDate}
                  onChange={(e) => setRecurringUntilDate(e.target.value)}
                  className="w-full sm:w-1/2 border border-amber-300 rounded-xl p-2 text-xs focus:outline-none focus:border-amber-600 bg-white font-mono"
                />
              </div>
            )}

            {recurringType !== 'NONE' && (
              <p className="text-[11px] text-amber-800 bg-amber-100/60 p-2 rounded-lg font-medium">
                💡 המערכת תיצור סדרת אימונים שבועית ביומן. ניתן לבטל או למחוק כל אימון בודד בעתיד במידת הצורך.
              </p>
            )}
          </div>

          {/* Limits: Participants, Age, Gender */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-700 font-bold mb-1">
                מגבלת נרשמים
              </label>
              <input
                type="number"
                required
                min="1"
                value={maxParticipants}
                onChange={(e) => setMaxParticipants(Number(e.target.value))}
                className="w-full border border-slate-300 rounded-xl p-2.5 text-xs focus:outline-none focus:border-emerald-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-700 font-bold mb-1">
                גיל מינימלי (אופציונלי)
              </label>
              <input
                type="number"
                placeholder="ללא הגבלה"
                value={ageMin}
                onChange={(e) => setAgeMin(e.target.value)}
                className="w-full border border-slate-300 rounded-xl p-2.5 text-xs focus:outline-none focus:border-emerald-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-700 font-bold mb-1">
                מגבלת מגדר
              </label>
              <select
                value={genderRestriction}
                onChange={(e) => setGenderRestriction(e.target.value as Gender)}
                className="w-full border border-slate-300 rounded-xl p-2.5 text-xs focus:outline-none focus:border-emerald-500 bg-white"
              >
                <option value={Gender.ALL}>כולם (מעורב)</option>
                <option value={Gender.MALE}>גברים בלבד 🚹</option>
                <option value={Gender.FEMALE}>נשים בלבד 🚺</option>
              </select>
            </div>
          </div>

          {/* Allowed Memberships Pills */}
          {category !== 'OPEN_GYM' && (
            <div className="pt-2 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-800 mb-1.5">
                סוגי מנוי המורשים להירשם לאימון זה:
              </label>
              <p className="mb-2 text-[10px] text-slate-500">ברירת המחדל ריקה. יש לבחור במפורש אילו מסלולים רשאים להירשם.</p>
              <SessionMembershipSelector value={allowedMemberships} onChange={setAllowedMemberships} />
            </div>
          )}

          {/* Submit Actions */}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              ביטול
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold transition shadow-md shadow-emerald-950/20 cursor-pointer flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              <span>צור אימון ביומן</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
