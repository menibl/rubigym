/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  User,
  UserRole,
  MembershipType,
  TrainingSession,
  OpenGymSession
} from '../types';
import {
  ChevronRight,
  ChevronLeft,
  Calendar as CalendarIcon,
  Clock,
  User as UserIcon,
  Users,
  CheckCircle,
  AlertCircle,
  Plus,
  Filter,
  Lock,
  Unlock,
  Dumbbell,
  Sparkles,
  X,
  Trash2,
  Grid,
  List,
  Flame,
  Edit3
} from 'lucide-react';

interface WeeklyCalendarProps {
  role: UserRole;
  activeUser: User;
  sessions: TrainingSession[];
  openGymSessions?: OpenGymSession[];
  users?: User[];
  onBookSession?: (session: TrainingSession) => void;
  onCancelBooking?: (sessionId: string) => void;
  onBookOpenGym?: (openGymSession: OpenGymSession) => void;
  onCancelOpenGym?: (openGymSessionId: string) => void;
  onEditSession?: (session: TrainingSession) => void;
  onOpenWorkoutProgram?: (session: TrainingSession) => void;
  onDeleteSession?: (sessionId: string, deleteSeries?: boolean) => void;
  onEditOpenGym?: (openGym: OpenGymSession) => void;
  onDeleteOpenGym?: (openGymId: string, deleteSeries?: boolean) => void;
  checkBookingEligibility?: (session: TrainingSession) => { eligible: boolean; reason?: string };
  onOpenCreateSessionModal?: (initialDate?: string, initialTime?: string) => void;
}

const HEBREW_DAYS = [
  'יום ראשון',
  'יום שני',
  'יום שלישי',
  'יום רביעי',
  'יום חמישי',
  'יום שישי'
];

const HOURS = [
  '07:00',
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
  '19:00',
  '20:00',
  '21:00'
];

export const WeeklyCalendar: React.FC<WeeklyCalendarProps> = ({
  role,
  activeUser,
  sessions,
  openGymSessions = [],
  users = [],
  onBookSession,
  onCancelBooking,
  onBookOpenGym,
  onCancelOpenGym,
  onDeleteSession,
  onEditSession,
  onOpenWorkoutProgram,
  onDeleteOpenGym,
  onEditOpenGym,
  checkBookingEligibility,
  onOpenCreateSessionModal
}) => {
  // Calendar Start Date State (Start of current week - Sunday)
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 is Sunday
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - dayOfWeek);
    sunday.setHours(0, 0, 0, 0);
    return sunday;
  });

  // Calendar view mode: 'HOURLY' (Hourly Timeline) vs 'CARDS' (Compact List)
  const [calendarViewMode, setCalendarViewMode] = useState<'HOURLY' | 'CARDS'>('HOURLY');

  // Mobile selected day filter: 'ALL' or dayIndex 0..5 (Sunday..Friday)
  const [mobileSelectedDay, setMobileSelectedDay] = useState<number | 'ALL'>(() => {
    const todayIdx = new Date().getDay();
    return todayIdx < 6 ? todayIdx : 0;
  });

  // Coach-specific toggle: My Sessions vs All Gym Sessions
  const [coachFilter, setCoachFilter] = useState<'MY_SESSIONS' | 'ALL_SESSIONS'>('ALL_SESSIONS');

  // Trainee-specific filter
  const [traineeFilter, setTraineeFilter] = useState<'ALL' | 'MY_BOOKINGS' | 'GROUP' | 'PERSONAL' | 'OPEN_GYM'>('ALL');

  // Selected session for details modal
  const [selectedItem, setSelectedItem] = useState<{
    type: 'SESSION' | 'OPEN_GYM';
    session?: TrainingSession;
    openGym?: OpenGymSession;
  } | null>(null);

  // Navigate Weeks
  const handlePrevWeek = () => {
    const prev = new Date(currentWeekStart);
    prev.setDate(prev.getDate() - 7);
    setCurrentWeekStart(prev);
  };

  const handleNextWeek = () => {
    const next = new Date(currentWeekStart);
    next.setDate(next.getDate() + 7);
    setCurrentWeekStart(next);
  };

  const handleTodayWeek = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - dayOfWeek);
    sunday.setHours(0, 0, 0, 0);
    setCurrentWeekStart(sunday);

    const todayIdx = today.getDay();
    setMobileSelectedDay(todayIdx < 6 ? todayIdx : 0);
  };

  // Helper to format local date YYYY-MM-DD
  const formatDateKey = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Compute 6 days of current week (Sunday to Friday - NO Saturday)
  const weekDays = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(currentWeekStart);
    d.setDate(currentWeekStart.getDate() + i);
    return {
      dayIndex: i,
      dayName: HEBREW_DAYS[i],
      shortName: ['א\'', 'ב\'', 'ג\'', 'ד\'', 'ה\'', 'ו\''][i],
      date: d,
      dateKey: formatDateKey(d),
      isToday: formatDateKey(d) === formatDateKey(new Date())
    };
  });

  // Format week range header
  const weekEnd = new Date(currentWeekStart);
  weekEnd.setDate(currentWeekStart.getDate() + 5);
  const weekRangeText = `${currentWeekStart.getDate()}/${currentWeekStart.getMonth() + 1}/${currentWeekStart.getFullYear()} - ${weekEnd.getDate()}/${weekEnd.getMonth() + 1}/${weekEnd.getFullYear()}`;

  // Helper: check if Trainee has registered/waitlisted for Open Gym
  const isOpenGymBooked = (og: OpenGymSession) => og.registeredUsers.includes(activeUser.id);
  const isOpenGymWaitlisted = (og: OpenGymSession) => og.waitlistUsers.includes(activeUser.id);

  // Filter items for a specific date
  const getItemsForDate = (dateKey: string) => {
    const targetDateObj = new Date(dateKey + 'T00:00:00');
    const targetDayOfWeek = targetDateObj.getDay();

    // 1. Group & Personal Sessions
    let explicitSessions = sessions.filter(s => s.date === dateKey);

    // Virtual project recurring sessions if not explicitly present for dateKey
    const virtualSessions: TrainingSession[] = [];
    const knownSeries = new Set(explicitSessions.map(s => s.seriesId).filter(Boolean));

    sessions.forEach(s => {
      if (s.recurringType && s.recurringType !== 'NONE' && s.date <= dateKey) {
        const sDateObj = new Date(s.date + 'T00:00:00');
        if (sDateObj.getDay() === targetDayOfWeek) {
          let valid = true;
          if (s.recurringType === 'WEEKLY_UNTIL_DATE' && s.recurringUntilDate) {
            valid = dateKey <= s.recurringUntilDate;
          }
          if (valid) {
            const sKey = s.seriesId || s.id;
            if (!knownSeries.has(sKey) && !explicitSessions.some(es => es.id === s.id)) {
              virtualSessions.push({
                ...s,
                id: s.seriesId ? `${s.seriesId}-${dateKey}` : `${s.id}-${dateKey}`,
                date: dateKey,
                registeredUsers: s.date === dateKey ? s.registeredUsers : [],
                waitlistUsers: s.date === dateKey ? s.waitlistUsers : []
              });
              knownSeries.add(sKey);
            }
          }
        }
      }
    });

    let daySessions = [...explicitSessions, ...virtualSessions];

    if (role === UserRole.COACH) {
      if (coachFilter === 'MY_SESSIONS') {
        daySessions = daySessions.filter(s => s.coachId === activeUser.id);
      }
    } else if (role === UserRole.TRAINEE) {
      if (traineeFilter === 'MY_BOOKINGS') {
        daySessions = daySessions.filter(s => s.registeredUsers.includes(activeUser.id) || s.waitlistUsers.includes(activeUser.id));
      } else if (traineeFilter === 'GROUP') {
        daySessions = daySessions.filter(s => !s.isPersonalTraining);
      } else if (traineeFilter === 'PERSONAL') {
        daySessions = daySessions.filter(s => s.isPersonalTraining);
      } else if (traineeFilter === 'OPEN_GYM') {
        daySessions = [];
      }
    }

    daySessions.sort((a, b) => a.time.localeCompare(b.time));

    // 2. Open Gym Sessions
    let explicitOpenGym = openGymSessions.filter(og => og.date === dateKey);
    const virtualOpenGym: OpenGymSession[] = [];
    const knownOgSeries = new Set(explicitOpenGym.map(og => og.seriesId).filter(Boolean));

    openGymSessions.forEach(og => {
      if (og.recurringType && og.recurringType !== 'NONE' && og.date <= dateKey) {
        const ogDateObj = new Date(og.date + 'T00:00:00');
        if (ogDateObj.getDay() === targetDayOfWeek) {
          let valid = true;
          if (og.recurringType === 'WEEKLY_UNTIL_DATE' && og.recurringUntilDate) {
            valid = dateKey <= og.recurringUntilDate;
          }
          if (valid) {
            const ogKey = og.seriesId || og.id;
            if (!knownOgSeries.has(ogKey) && !explicitOpenGym.some(eog => eog.id === og.id)) {
              virtualOpenGym.push({
                ...og,
                id: og.seriesId ? `${og.seriesId}-${dateKey}` : `${og.id}-${dateKey}`,
                date: dateKey,
                registeredUsers: og.date === dateKey ? og.registeredUsers : [],
                waitlistUsers: og.date === dateKey ? og.waitlistUsers : []
              });
              knownOgSeries.add(ogKey);
            }
          }
        }
      }
    });

    let dayOpenGym = [...explicitOpenGym, ...virtualOpenGym];

    if (role === UserRole.TRAINEE) {
      if (traineeFilter === 'GROUP' || traineeFilter === 'PERSONAL') {
        dayOpenGym = [];
      } else if (traineeFilter === 'MY_BOOKINGS') {
        dayOpenGym = dayOpenGym.filter(og => isOpenGymBooked(og) || isOpenGymWaitlisted(og));
      }
    }

    return {
      sessions: daySessions,
      openGym: dayOpenGym
    };
  };

  // Helper: Filter items specifically for dateKey AND hour slot
  const getItemsForDateAndHour = (dateKey: string, hourSlot: string) => {
    const { sessions: daySessions, openGym: dayOpenGym } = getItemsForDate(dateKey);

    const slotHourNum = parseInt(hourSlot.split(':')[0], 10);

    const slotSessions = daySessions.filter(s => {
      const sHour = parseInt(s.time.split(':')[0], 10);
      return sHour === slotHourNum;
    });

    const slotOpenGym = dayOpenGym.filter(og => {
      const ogHour = parseInt(og.timeSlot.split(':')[0], 10);
      return ogHour === slotHourNum;
    });

    return {
      sessions: slotSessions,
      openGym: slotOpenGym
    };
  };

  // Filtered displayed days if mobile or specific day selected
  const visibleDays = mobileSelectedDay === 'ALL'
    ? weekDays
    : [weekDays[mobileSelectedDay as number]].filter(Boolean);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden dir-rtl">
      {/* CALENDAR HEADER & CONTROLS */}
      <div className="p-3 border-b border-slate-200/80 bg-slate-50 space-y-2.5">
        <div className="flex flex-wrap justify-between items-center gap-2">
          {/* Title & Week Range Badge */}
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg shrink-0">
              <CalendarIcon className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-extrabold text-slate-800">
                יומן אימונים לפי שעות
              </h2>
              <span className="text-[11px] font-mono text-slate-600 bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-2xs">
                {weekRangeText}
              </span>
            </div>
          </div>

          {/* View Mode Toggle & Navigation */}
          <div className="flex items-center gap-2 mr-auto flex-wrap">
            {/* View Mode Selector */}
            <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg text-xs font-bold">
              <button
                onClick={() => setCalendarViewMode('HOURLY')}
                className={`px-2.5 py-1 rounded-md transition flex items-center gap-1 cursor-pointer ${
                  calendarViewMode === 'HOURLY'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
                title="תצוגת לוח שנה מחולק לפי שעות"
              >
                <Grid className="w-3.5 h-3.5" />
                <span>יומן שעות</span>
              </button>
              <button
                onClick={() => setCalendarViewMode('CARDS')}
                className={`px-2.5 py-1 rounded-md transition flex items-center gap-1 cursor-pointer ${
                  calendarViewMode === 'CARDS'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
                title="תצוגת כרטיסים מקובצת"
              >
                <List className="w-3.5 h-3.5" />
                <span>רשימה</span>
              </button>
            </div>

            {/* Compact Week Navigation */}
            <div className="flex items-center gap-1">
              <button
                onClick={handlePrevWeek}
                title="שבוע קודם"
                className="p-1 sm:px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition flex items-center gap-0.5 cursor-pointer shadow-2xs"
              >
                <ChevronRight className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">קודם</span>
              </button>

              <button
                onClick={handleTodayWeek}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-2xs"
              >
                היום
              </button>

              <button
                onClick={handleNextWeek}
                title="שבוע הבא"
                className="p-1 sm:px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition flex items-center gap-0.5 cursor-pointer shadow-2xs"
              >
                <span className="hidden sm:inline">הבא</span>
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* ROLE SPECIFIC TOGGLES AND FILTERS */}
        {(role === UserRole.MANAGER || role === UserRole.COACH) && (
          <div className="flex flex-wrap justify-between items-center gap-2 pt-2 border-t border-slate-200/60 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-600 font-bold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                ניהול יומן (רובי):
              </span>
              <span className="text-[10px] text-slate-500 bg-purple-50 text-purple-800 border border-purple-200 px-2 py-0.5 rounded-md font-semibold">
                ניתן לקיים אימון אישי 🏋️ ו-Open Gym 🔓 במקביל באותה שעה
              </span>
            </div>

            {onOpenCreateSessionModal && (
              <button
                onClick={onOpenCreateSessionModal}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-1.5 px-3 rounded-lg shadow-2xs transition flex items-center gap-1 cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>הגדר אימון חדש במערכת</span>
              </button>
            )}
          </div>
        )}

        {role === UserRole.TRAINEE && (
          <div className="flex flex-wrap items-center justify-between gap-1.5 pt-2 border-t border-slate-200/60 text-xs">
            <div className="flex items-center gap-1 text-[11px] text-slate-600 font-medium">
              <Filter className="w-3 h-3 text-emerald-600" />
              <span>סינון תצוגה:</span>
            </div>

            <div className="flex flex-wrap gap-1">
              {[
                { id: 'ALL', label: '✨ הכל' },
                { id: 'MY_BOOKINGS', label: '✅ הרשמות שלי' },
                { id: 'GROUP', label: '👥 קבוצתי' },
                { id: 'PERSONAL', label: '🏋️ אישי' },
                { id: 'OPEN_GYM', label: '🔓 Open Gym' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setTraineeFilter(tab.id as any)}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition cursor-pointer ${
                    traineeFilter === tab.id
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* DATE STRIP BUTTONS (Sunday to Friday) */}
        <div className="pt-2 border-t border-slate-200/60">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin dir-rtl">
            <button
              onClick={() => setMobileSelectedDay('ALL')}
              className={`px-3 py-1 rounded-lg text-xs font-bold shrink-0 transition flex items-center gap-1 cursor-pointer ${
                mobileSelectedDay === 'ALL'
                  ? 'bg-slate-800 text-white shadow-2xs ring-1 ring-slate-700'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span>✨ כל השבוע (א'-ו')</span>
            </button>

            {weekDays.map(day => {
              const { sessions: dSessions, openGym: dOpenGym } = getItemsForDate(day.dateKey);
              const totalCount = dSessions.length + dOpenGym.length;
              const isSelected = mobileSelectedDay === day.dayIndex;

              return (
                <button
                  key={day.dateKey}
                  onClick={() => setMobileSelectedDay(day.dayIndex)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 transition flex items-center gap-1.5 cursor-pointer relative shadow-2xs ${
                    isSelected
                      ? 'bg-emerald-600 text-white ring-2 ring-emerald-400 shadow-xs'
                      : day.isToday
                      ? 'bg-emerald-50 border border-emerald-300 text-emerald-900 hover:bg-emerald-100'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span>{day.shortName}</span>
                  <span className={`text-[10px] font-mono px-1 rounded ${
                    isSelected
                      ? 'bg-emerald-700/80 text-emerald-100'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {day.date.getDate()}/{day.date.getMonth() + 1}
                  </span>

                  {totalCount > 0 && (
                    <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded-full ${
                      isSelected
                        ? 'bg-white text-emerald-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {totalCount}
                    </span>
                  )}

                  {day.isToday && !isSelected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* MODE 1: HOURLY TIMELINE CALENDAR GRID (Google Calendar / Outlook Style) */}
      {calendarViewMode === 'HOURLY' && (
        <div className="overflow-x-auto">
          <div className="min-w-[800px] border-collapse bg-slate-100/40">
            {/* STICKY DAY HEADERS ROW */}
            <div className={`grid ${mobileSelectedDay === 'ALL' ? 'grid-cols-[70px_repeat(6,minmax(110px,1fr))]' : 'grid-cols-[70px_1fr]'} bg-slate-100 border-b border-slate-200 sticky top-0 z-20 shadow-2xs`}>
              {/* TIME COLUMN HEADER */}
              <div className="p-2 text-center font-extrabold text-xs text-slate-800 bg-slate-200/90 border-l border-slate-300 flex items-center justify-center gap-1 select-none">
                <Clock className="w-3.5 h-3.5 text-slate-700" />
                <span>שעה</span>
              </div>

              {/* DAY COLUMNS HEADERS */}
              {visibleDays.map(day => (
                <div
                  key={day.dateKey}
                  onClick={() => setMobileSelectedDay(mobileSelectedDay === day.dayIndex ? 'ALL' : day.dayIndex)}
                  className={`p-2.5 text-center border-l border-slate-200 cursor-pointer select-none transition ${
                    day.isToday
                      ? 'bg-emerald-100/80 text-emerald-950 font-extrabold border-emerald-300'
                      : 'bg-slate-50 text-slate-800 font-bold hover:bg-slate-100'
                  }`}
                >
                  <div className="text-xs font-bold">{day.dayName}</div>
                  <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                    {day.date.getDate()}/${day.date.getMonth() + 1}
                  </div>
                  {day.isToday && (
                    <span className="inline-block bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full mt-0.5 shadow-2xs">
                      היום
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* HOURLY ROWS */}
            <div className="divide-y divide-slate-200">
              {HOURS.map(hour => (
                <div
                  key={hour}
                  className={`grid ${mobileSelectedDay === 'ALL' ? 'grid-cols-[70px_repeat(6,minmax(110px,1fr))]' : 'grid-cols-[70px_1fr]'} min-h-[52px] bg-white`}
                >
                  {/* TIME SLOT LABEL CELL - HIGH CONTRAST DARK BADGE */}
                  <div className="p-1 border-l border-slate-300 bg-slate-900 text-center font-mono font-extrabold text-xs text-white flex flex-col justify-center items-center shadow-2xs select-none">
                    <span className="text-amber-300 font-extrabold text-xs tracking-tight">{hour}</span>
                    <span className="text-[9px] text-slate-300 font-sans font-semibold mt-0.5">
                      {parseInt(hour) < 12 ? 'בוקר' : parseInt(hour) < 17 ? 'צהריים' : 'ערב'}
                    </span>
                  </div>

                  {/* DAY CELLS FOR THIS HOUR */}
                  {visibleDays.map(day => {
                    const { sessions: slotSessions, openGym: slotOpenGym } = getItemsForDateAndHour(day.dateKey, hour);
                    const totalSlotItems = slotSessions.length + slotOpenGym.length;

                    return (
                      <div
                        key={`${day.dateKey}-${hour}`}
                        className={`p-1.5 border-l border-slate-200/80 relative transition group min-h-[52px] ${
                          day.isToday ? 'bg-emerald-50/10' : ''
                        }`}
                      >
                        {totalSlotItems === 0 ? (
                          <div
                            onClick={() => onOpenCreateSessionModal && onOpenCreateSessionModal(day.dateKey, hour)}
                            className="h-full w-full rounded-lg border border-dashed border-transparent group-hover:border-slate-300 group-hover:bg-slate-50/80 flex items-center justify-center text-slate-400 opacity-0 group-hover:opacity-100 transition cursor-pointer p-1"
                            title={`לחץ להוספת אימון ב-` + day.dayName + ` בשעה ` + hour}
                          >
                            {(role === UserRole.MANAGER || role === UserRole.COACH) && (
                              <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1 bg-white px-2 py-1 rounded-md shadow-2xs border border-emerald-200">
                                <Plus className="w-3 h-3" />
                                הוסף אימון ב-{hour}
                              </span>
                            )}
                          </div>
                        ) : (
                          /* PARALLEL SESSIONS SUPPORT (e.g. 1 Personal Training + 1 Open Gym) */
                          <div className={`grid ${totalSlotItems > 1 ? 'grid-cols-1 md:grid-cols-2 gap-1.5' : 'grid-cols-1'} h-full`}>
                            {/* OPEN GYM SLOTS IN THIS HOUR */}
                            {slotOpenGym.map(og => {
                              const isUserBooked = isOpenGymBooked(og);
                              const isUserWaitlist = isOpenGymWaitlisted(og);

                              return (
                                <div
                                  key={og.id}
                                  onClick={() => setSelectedItem({ type: 'OPEN_GYM', openGym: og })}
                                  className={`p-2 rounded-xl border text-right transition cursor-pointer shadow-2xs hover:shadow-xs relative space-y-1 ${
                                    isUserBooked
                                      ? 'bg-emerald-50 border-emerald-400 ring-1 ring-emerald-300'
                                      : isUserWaitlist
                                      ? 'bg-amber-50 border-amber-300'
                                      : 'bg-purple-50/90 hover:bg-purple-100/90 border-purple-200'
                                  }`}
                                >
                                  <div className="flex justify-between items-center">
                                    <span className="bg-purple-200 text-purple-900 text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                                      <Unlock className="w-2.5 h-2.5" />
                                      Open Gym
                                    </span>
                                    <span className="text-[9px] font-mono font-bold text-purple-900">
                                      👥 {og.registeredUsers.length}/{og.maxParticipants}
                                    </span>
                                  </div>

                                  <div className="text-xs font-extrabold text-slate-800 flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-purple-700 shrink-0" />
                                    <span>{og.timeSlot}</span>
                                  </div>

                                  {isUserBooked && (
                                    <span className="inline-block bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.2 rounded">
                                      ✅ רשום/ה
                                    </span>
                                  )}
                                </div>
                              );
                            })}

                            {/* TRAINING SESSIONS IN THIS HOUR */}
                            {slotSessions.map(session => {
                              const isRegistered = session.registeredUsers.includes(activeUser.id);
                              const isWaitlist = session.waitlistUsers.includes(activeUser.id);
                              const isFull = session.registeredUsers.length >= session.maxParticipants;
                              const isMineCoach = session.coachId === activeUser.id;
                              const eligCheck = checkBookingEligibility ? checkBookingEligibility(session) : { eligible: true };

                              return (
                                <div
                                  key={session.id}
                                  onClick={() => setSelectedItem({ type: 'SESSION', session })}
                                  className={`p-2 rounded-xl border text-right transition cursor-pointer shadow-2xs hover:shadow-xs relative space-y-1 ${
                                    isRegistered
                                      ? 'bg-emerald-50 border-emerald-400 ring-1 ring-emerald-300'
                                      : isWaitlist
                                      ? 'bg-amber-50 border-amber-300'
                                      : session.isPersonalTraining
                                      ? 'bg-sky-50/90 hover:bg-sky-100/90 border-sky-300 text-sky-950'
                                      : isMineCoach
                                      ? 'bg-emerald-50/70 border-emerald-300'
                                      : !eligCheck.eligible && role === UserRole.TRAINEE
                                      ? 'bg-slate-50 border-slate-200 opacity-75'
                                      : 'bg-white hover:bg-slate-50 border-slate-200'
                                  }`}
                                >
                                  <div className="flex justify-between items-center">
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                      session.isPersonalTraining
                                        ? 'bg-sky-200 text-sky-900'
                                        : 'bg-emerald-100 text-emerald-800'
                                    }`}>
                                      {session.isPersonalTraining ? '🏋️ אימונים אישיים' : '👥 קבוצתי'}
                                    </span>

                                    <span className={`text-[9px] font-mono font-bold px-1 rounded ${
                                      isFull ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'
                                    }`}>
                                      {session.registeredUsers.length}/{session.maxParticipants}
                                    </span>
                                  </div>

                                  <div className="text-xs font-extrabold text-slate-900 leading-tight">
                                    {session.title}
                                  </div>

                                  <div className="text-[10px] text-slate-600 font-semibold flex items-center gap-1">
                                    <Clock className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                                    <span>{session.time}</span>
                                    <span className="text-[9px] text-slate-400">({session.durationMinutes} דק')</span>
                                  </div>

                                  <div className="text-[9px] text-slate-500 font-medium">
                                    מאמן: {session.coachName}
                                  </div>

                                  {/* TRAINEE STATUS BADGE */}
                                  {role === UserRole.TRAINEE && (
                                    <div className="mt-1">
                                      {isRegistered ? (
                                        <span className="bg-emerald-600 text-white text-[9px] font-extrabold px-1.5 py-0.2 rounded flex items-center gap-0.5 w-max">
                                          <CheckCircle className="w-2.5 h-2.5" />
                                          רשום/ה
                                        </span>
                                      ) : isWaitlist ? (
                                        <span className="bg-amber-600 text-white text-[9px] font-extrabold px-1.5 py-0.2 rounded w-max">
                                          ⏳ בהמתנה
                                        </span>
                                      ) : null}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODE 2: CARDS LIST VIEW */}
      {calendarViewMode === 'CARDS' && (
        <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 bg-slate-50/50">
          {visibleDays.map(day => {
            const { sessions: daySessions, openGym: dayOpenGym } = getItemsForDate(day.dateKey);
            const totalCount = daySessions.length + dayOpenGym.length;

            return (
              <div
                key={day.dateKey}
                className={`bg-white rounded-xl border p-3 space-y-2.5 ${
                  day.isToday ? 'border-emerald-300 ring-1 ring-emerald-200' : 'border-slate-200'
                }`}
              >
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-800">{day.dayName}</h3>
                    <p className="text-[11px] font-mono text-slate-500">
                      {day.date.getDate()}/{day.date.getMonth() + 1}/{day.date.getFullYear()}
                    </p>
                  </div>
                  <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                    {totalCount} אימונים
                  </span>
                </div>

                {totalCount === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">
                    אין אימונים מתוכננים ליום זה
                  </div>
                ) : (
                  <div className="space-y-2">
                    {dayOpenGym.map(og => (
                      <div
                        key={og.id}
                        onClick={() => setSelectedItem({ type: 'OPEN_GYM', openGym: og })}
                        className="p-2.5 rounded-lg border border-purple-200 bg-purple-50/80 hover:bg-purple-100 text-right cursor-pointer transition space-y-1"
                      >
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-purple-900 flex items-center gap-1">
                            <Unlock className="w-3 h-3 text-purple-700" />
                            Open Gym ({og.timeSlot})
                          </span>
                          <span className="text-[10px] font-mono font-bold text-slate-600">
                            👥 {og.registeredUsers.length}/{og.maxParticipants}
                          </span>
                        </div>
                      </div>
                    ))}

                    {daySessions.map(session => (
                      <div
                        key={session.id}
                        onClick={() => setSelectedItem({ type: 'SESSION', session })}
                        className={`p-2.5 rounded-lg border text-right cursor-pointer transition space-y-1 ${
                          session.isPersonalTraining
                            ? 'bg-sky-50 border-sky-200 hover:bg-sky-100'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-extrabold text-slate-900">{session.title}</span>
                          <span className="text-[10px] font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                            {session.registeredUsers.length}/{session.maxParticipants}
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 flex items-center gap-2">
                          <Clock className="w-3 h-3 text-emerald-600" />
                          <span>{session.time}</span>
                          <span>| מאמן: {session.coachName}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* SESSION / OPEN GYM DETAIL MODAL */}
      {selectedItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in dir-rtl">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100 relative space-y-4">
            <button
              onClick={() => setSelectedItem(null)}
              className="absolute top-4 left-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* MODAL CONTENT */}
            {selectedItem.type === 'SESSION' && selectedItem.session && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                    selectedItem.session.isPersonalTraining
                      ? 'bg-sky-100 text-sky-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {selectedItem.session.isPersonalTraining ? '🏋️ אימון אישי' : '👥 אימון קבוצתי'}
                  </span>
                  {selectedItem.session.recurringType && selectedItem.session.recurringType !== 'NONE' && (
                    <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                      🔁 אימון מחזורי ({selectedItem.session.recurringType === 'WEEKLY_UNLIMITED' ? 'כל שבוע' : `כל שבוע עד ${selectedItem.session.recurringUntilDate || ''}`})
                    </span>
                  )}
                  <span className="text-xs font-mono text-slate-500">
                    תאריך: {selectedItem.session.date} | שעה: {selectedItem.session.time}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-slate-900">
                  {selectedItem.session.title}
                </h3>

                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-xs text-slate-700">
                  <div>
                    <span className="text-slate-400 block text-[10px]">מאמן אחראי:</span>
                    <span className="font-bold text-slate-800">{selectedItem.session.coachName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">תפוסת רשומים:</span>
                    <span className="font-bold text-emerald-700">
                      {selectedItem.session.registeredUsers.length} / {selectedItem.session.maxParticipants} רשומים
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">תור המתנה:</span>
                    <span className="font-bold text-amber-700">
                      {selectedItem.session.waitlistUsers.length} ממתינים
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">משך האימון:</span>
                    <span className="font-bold text-slate-800">{selectedItem.session.durationMinutes} דקות</span>
                  </div>
                </div>

                {/* Eligibility Notice for Trainee */}
                {role === UserRole.TRAINEE && checkBookingEligibility && (
                  (() => {
                    const check = checkBookingEligibility(selectedItem.session!);
                    if (!check.eligible) {
                      return (
                        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3 text-xs flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold block">הגבלת הרשמה לאימון:</span>
                            <span>{check.reason}</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()
                )}

                {/* Registered users list preview */}
                <div className="space-y-1.5 border-t border-slate-100 pt-3">
                  <span className="text-xs font-bold text-slate-800 block">
                    מתאמנים רשומים ({selectedItem.session.registeredUsers.length}):
                  </span>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1">
                    {selectedItem.session.registeredUsers.length === 0 ? (
                      <span className="text-xs text-slate-400">אין עדיין נרשמים</span>
                    ) : (
                      selectedItem.session.registeredUsers.map(uid => {
                        const u = users.find(usr => usr.id === uid);
                        return (
                          <span
                            key={uid}
                            className="bg-slate-100 border border-slate-200 text-slate-700 text-[11px] px-2 py-0.5 rounded-lg font-medium"
                          >
                            {u ? u.name : uid}
                          </span>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* ACTION BUTTONS IN MODAL */}
                <div className="border-t border-slate-100 pt-3 flex items-center justify-between gap-2">
                  {/* TRAINEE BOOK / CANCEL ACTIONS */}
                  {role === UserRole.TRAINEE && (
                    <>
                      {selectedItem.session.registeredUsers.includes(activeUser.id) ? (
                        <button
                          onClick={() => {
                            if (onCancelBooking) onCancelBooking(selectedItem.session!.id);
                            setSelectedItem(null);
                          }}
                          className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 rounded-xl text-xs transition cursor-pointer shadow-2xs"
                        >
                          ❌ ביטול הרשמה לאימון זה
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            if (onBookSession) onBookSession(selectedItem.session!);
                            setSelectedItem(null);
                          }}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-xl text-xs transition cursor-pointer shadow-2xs"
                        >
                          🟢 הרשמה לאימון זה
                        </button>
                      )}
                    </>
                  )}

                  {/* MANAGER / COACH ACTIONS FOR SESSION */}
                  {(role === UserRole.MANAGER || role === UserRole.COACH) && (
                    <div className="w-full flex justify-between items-center gap-2 flex-wrap border-t border-slate-100 pt-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        {onOpenWorkoutProgram && (
                          <button
                            onClick={() => {
                              const curr = selectedItem.session!;
                              setSelectedItem(null);
                              onOpenWorkoutProgram(curr);
                            }}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3.5 py-2 rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                          >
                            <Dumbbell className="w-4 h-4" />
                            <span>{selectedItem.session.isPersonalTraining ? 'צור / ערוך תוכנית אישית' : 'צור / ערוך תוכנית לאימון'}</span>
                          </button>
                        )}
                        {onEditSession && (
                          <button
                            onClick={() => {
                              const curr = selectedItem.session!;
                              setSelectedItem(null);
                              onEditSession(curr);
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3.5 py-2 rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                          >
                            <Edit3 className="w-4 h-4" />
                            <span>ערוך אימון</span>
                          </button>
                        )}

                        {onDeleteSession && (
                          <>
                            <button
                              onClick={() => {
                                if (confirm('האם אתה בטוח שברצונך למחוק אימון בודד זה מהיומן?')) {
                                  onDeleteSession(selectedItem.session!.id, false);
                                  setSelectedItem(null);
                                }
                              }}
                              className="bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 font-bold px-3 py-2 rounded-xl text-xs transition flex items-center gap-1 cursor-pointer"
                              title="מחק רק את המופע הבודד הזה"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span>מחק אימון בודד</span>
                            </button>

                            {(selectedItem.session?.seriesId || (selectedItem.session?.recurringType && selectedItem.session.recurringType !== 'NONE')) && (
                              <button
                                onClick={() => {
                                  if (confirm('האם אתה בטוח שברצונך למחוק את כל האימונים בסדרה המחזורית הזו?')) {
                                    onDeleteSession(selectedItem.session!.id, true);
                                    setSelectedItem(null);
                                  }
                                }}
                                className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-3 py-2 rounded-xl text-xs transition flex items-center gap-1 cursor-pointer shadow-xs"
                                title="מחק את כל המופעים של האימון בסדרה המחזורית"
                              >
                                <Trash2 className="w-4 h-4" />
                                <span>מחק את כל הסדרה המחזורית 🔁</span>
                              </button>
                            )}
                          </>
                        )}
                      </div>

                      <button
                        onClick={() => setSelectedItem(null)}
                        className="bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold px-4 py-2 rounded-xl text-xs transition cursor-pointer mr-auto"
                      >
                        סגור
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* OPEN GYM MODAL */}
            {selectedItem.type === 'OPEN_GYM' && selectedItem.openGym && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="bg-purple-100 text-purple-800 text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1">
                    <Unlock className="w-3.5 h-3.5" />
                    Open Gym (שעות פתוחות)
                  </span>
                  <span className="text-xs font-mono text-slate-500">
                    תאריך: {selectedItem.openGym.date}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-slate-900">
                  אימון חופשי - Open Gym ({selectedItem.openGym.timeSlot})
                </h3>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-xs text-slate-700 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">תפוסה מורשית:</span>
                    <span className="font-bold text-slate-800">
                      {selectedItem.openGym.registeredUsers.length} / {selectedItem.openGym.maxParticipants} מתאמנים
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">תור המתנה:</span>
                    <span className="font-bold text-amber-700">
                      {selectedItem.openGym.waitlistUsers.length} ממתינים
                    </span>
                  </div>
                </div>

                {/* Registered users list preview */}
                <div className="space-y-1.5 border-t border-slate-100 pt-3">
                  <span className="text-xs font-bold text-slate-800 block">
                    מתאמנים רשומים ({selectedItem.openGym.registeredUsers.length}):
                  </span>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1">
                    {selectedItem.openGym.registeredUsers.length === 0 ? (
                      <span className="text-xs text-slate-400">אין עדיין נרשמים</span>
                    ) : (
                      selectedItem.openGym.registeredUsers.map(uid => {
                        const u = users.find(usr => usr.id === uid);
                        return (
                          <span
                            key={uid}
                            className="bg-purple-50 border border-purple-200 text-purple-900 text-[11px] px-2 py-0.5 rounded-lg font-medium"
                          >
                            {u ? u.name : uid}
                          </span>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* TRAINEE BOOK / CANCEL ACTIONS */}
                {role === UserRole.TRAINEE && (
                  <div className="border-t border-slate-100 pt-3 flex items-center justify-between gap-2">
                    {isOpenGymBooked(selectedItem.openGym) ? (
                      <button
                        onClick={() => {
                          if (onCancelOpenGym) onCancelOpenGym(selectedItem.openGym!.id);
                          setSelectedItem(null);
                        }}
                        className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 rounded-xl text-xs transition cursor-pointer shadow-2xs"
                      >
                        ❌ ביטול הרשמה ל-Open Gym
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          if (onBookOpenGym) onBookOpenGym(selectedItem.openGym!);
                          setSelectedItem(null);
                        }}
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 rounded-xl text-xs transition cursor-pointer shadow-2xs"
                      >
                        🔓 הרשמה ל-Open Gym
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedItem(null)}
                      className="bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold px-4 py-2 rounded-xl text-xs transition cursor-pointer shrink-0"
                    >
                      סגור
                    </button>
                  </div>
                )}

                {/* MANAGER / COACH ACTIONS FOR OPEN GYM */}
                {(role === UserRole.MANAGER || role === UserRole.COACH) && (
                  <div className="border-t border-slate-100 pt-3 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      {onEditOpenGym && (
                        <button
                          onClick={() => {
                            const gym = selectedItem.openGym!;
                            setSelectedItem(null);
                            onEditOpenGym(gym);
                          }}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3.5 py-2 rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <Edit3 className="w-4 h-4" />
                          <span>ערוך Open Gym</span>
                        </button>
                      )}
                      {onDeleteOpenGym && (
                        <>
                          <button
                            onClick={() => {
                              if (confirm('האם אתה בטוח שברצונך למחוק מופע Open Gym זה?')) {
                                onDeleteOpenGym(selectedItem.openGym!.id, false);
                                setSelectedItem(null);
                              }
                            }}
                            className="bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 font-bold px-3 py-2 rounded-xl text-xs transition flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>מחק Open Gym בודד</span>
                          </button>
                          {(selectedItem.openGym?.seriesId || (selectedItem.openGym?.recurringType && selectedItem.openGym.recurringType !== 'NONE')) && (
                            <button
                              onClick={() => {
                                if (confirm('האם אתה בטוח שברצונך למחוק את כל סדרת ה-Open Gym הזו?')) {
                                  onDeleteOpenGym(selectedItem.openGym!.id, true);
                                  setSelectedItem(null);
                                }
                              }}
                              className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-3 py-2 rounded-xl text-xs transition flex items-center gap-1 cursor-pointer shadow-xs"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span>מחק את כל הסדרה 🔁</span>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                    <button
                      onClick={() => setSelectedItem(null)}
                      className="bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold px-4 py-2 rounded-xl text-xs transition cursor-pointer mr-auto"
                    >
                      סגור
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
