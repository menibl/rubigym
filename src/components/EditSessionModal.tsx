/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  User,
  TrainingSession,
  OpenGymSession,
  MuscleGroup,
  Gender,
  MembershipType,
  MEMBERSHIP_TYPE_LABELS,
  CURRENT_MEMBERSHIP_CATALOG
} from '../types';
import { X, Calendar, Clock, Users, Dumbbell, Sparkles, Repeat, ShieldCheck, Edit3 } from 'lucide-react';

interface EditSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  session?: TrainingSession | null;
  openGym?: OpenGymSession | null;
  users: User[];
  activeUser: User;
  onSaveSession: (updatedSession: TrainingSession, updateSeries: boolean, originalDateKey?: string) => void;
  onSaveOpenGym?: (updatedOpenGym: OpenGymSession, updateSeries: boolean, originalDateKey?: string) => void;
}

export const EditSessionModal: React.FC<EditSessionModalProps> = ({
  isOpen,
  onClose,
  session,
  openGym,
  users,
  activeUser,
  onSaveSession,
  onSaveOpenGym
}) => {
  if (!isOpen || (!session && !openGym)) return null;

  const isSession = !!session;
  const targetItem = session || openGym;

  const isRecurring = !!(
    targetItem?.seriesId ||
    (targetItem?.recurringType && targetItem?.recurringType !== 'NONE')
  );

  // Form State
  const [title, setTitle] = useState(session?.title || '');
  const [date, setDate] = useState(session?.date || openGym?.date || '');
  const [time, setTime] = useState(session?.time || openGym?.timeSlot?.split(' - ')[0] || '18:00');
  const [durationMinutes, setDurationMinutes] = useState<number>(session?.durationMinutes || 60);
  const [coachId, setCoachId] = useState(session?.coachId || activeUser.id);
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>(session?.muscleGroup || MuscleGroup.UPPER);
  const [maxParticipants, setMaxParticipants] = useState<number>(session?.maxParticipants || openGym?.maxParticipants || 10);
  const [ageMin, setAgeMin] = useState<string>(session?.ageMin ? String(session.ageMin) : '');
  const [ageMax, setAgeMax] = useState<string>(session?.ageMax ? String(session.ageMax) : '');
  const [genderRestriction, setGenderRestriction] = useState<Gender>(session?.genderRestriction || Gender.ALL);
  const [allowedMemberships, setAllowedMemberships] = useState<MembershipType[]>(
    session?.allowedMemberships || [...CURRENT_MEMBERSHIP_CATALOG]
  );
  const [isPersonalTraining, setIsPersonalTraining] = useState<boolean>(session?.isPersonalTraining || false);

  // Recurrence scope state
  const [updateSeries, setUpdateSeries] = useState<boolean>(false);

  useEffect(() => {
    if (session) {
      setTitle(session.title);
      setDate(session.date);
      setTime(session.time);
      setDurationMinutes(session.durationMinutes);
      setCoachId(session.coachId);
      setMuscleGroup(session.muscleGroup);
      setMaxParticipants(session.maxParticipants);
      setAgeMin(session.ageMin ? String(session.ageMin) : '');
      setAgeMax(session.ageMax ? String(session.ageMax) : '');
      setGenderRestriction(session.genderRestriction || Gender.ALL);
      setAllowedMemberships(session.allowedMemberships || [...CURRENT_MEMBERSHIP_CATALOG]);
      setIsPersonalTraining(session.isPersonalTraining || false);
    } else if (openGym) {
      setDate(openGym.date);
      setTime(openGym.timeSlot ? openGym.timeSlot.split(' - ')[0] : '14:00');
      setMaxParticipants(openGym.maxParticipants);
    }
    setUpdateSeries(false);
  }, [session, openGym]);

  const coaches = users.filter(u => u.role === 'COACH' || u.role === 'MANAGER');

  const toggleMembership = (type: MembershipType) => {
    if (allowedMemberships.includes(type)) {
      if (allowedMemberships.length === 1) return;
      setAllowedMemberships(allowedMemberships.filter(t => t !== type));
    } else {
      setAllowedMemberships([...allowedMemberships, type]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (session) {
      const selectedCoach = users.find(u => u.id === coachId) || activeUser;
      const updated: TrainingSession = {
        ...session,
        title,
        date,
        time,
        durationMinutes,
        coachId: selectedCoach.id,
        coachName: selectedCoach.name,
        muscleGroup,
        maxParticipants,
        ageMin: ageMin ? Number(ageMin) : undefined,
        ageMax: ageMax ? Number(ageMax) : undefined,
        genderRestriction,
        allowedMemberships,
        isPersonalTraining
      };
      onSaveSession(updated, updateSeries, session.date);
    } else if (openGym && onSaveOpenGym) {
      const endHour = String(parseInt(time.split(':')[0]) + 2).padStart(2, '0');
      const timeSlotStr = `${time} - ${endHour}:00`;
      const updated: OpenGymSession = {
        ...openGym,
        date,
        timeSlot: timeSlotStr,
        maxParticipants
      };
      onSaveOpenGym(updated, updateSeries, openGym.date);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-lg w-full overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* MODAL HEADER */}
        <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Edit3 className="text-emerald-400" size={20} />
            <h2 className="text-base font-extrabold">
              {isSession ? 'עריכת אימון ביומן' : 'עריכת שעות Open Gym'}
            </h2>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* MODAL FORM */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* RECURRENCE EDIT NOTICE */}
          {isRecurring && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                <Repeat className="w-4 h-4 text-amber-600" />
                <span>זהו אימון מחזורי בסדרה!</span>
              </div>
              <div className="space-y-1.5 text-xs text-amber-800">
                <label className="flex items-center gap-2 cursor-pointer font-bold">
                  <input
                    type="radio"
                    name="updateSeries"
                    checked={!updateSeries}
                    onChange={() => setUpdateSeries(false)}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>🎯 עדכן מופע בודד זה בלבד (תאריך: {targetItem?.date})</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-bold">
                  <input
                    type="radio"
                    name="updateSeries"
                    checked={updateSeries}
                    onChange={() => setUpdateSeries(true)}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>🔁 עדכן את כל הסדרה המחזורית</span>
                </label>
              </div>
            </div>
          )}

          {/* SESSION SPECIFIC FIELDS */}
          {isSession && (
            <>
              {/* CATEGORY & TITLE */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">שם האימון</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="לדוגמה: Crossfit WOD / אימון כוח עליון"
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-xs font-bold focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                />
              </div>

              {/* COACH & MUSCLE GROUP */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">מאמן אחראי</label>
                  <select
                    value={coachId}
                    onChange={(e) => setCoachId(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl p-2 text-xs font-bold focus:outline-none focus:border-emerald-500"
                  >
                    {coaches.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">קבוצת שרירים</label>
                  <select
                    value={muscleGroup}
                    onChange={(e) => setMuscleGroup(e.target.value as MuscleGroup)}
                    className="w-full border border-slate-300 rounded-xl p-2 text-xs font-bold focus:outline-none focus:border-emerald-500"
                  >
                    <option value={MuscleGroup.UPPER}>פלג גוף עליון</option>
                    <option value={MuscleGroup.LEGS}>רגליים וישבן</option>
                    <option value={MuscleGroup.BACK}>גב</option>
                    <option value={MuscleGroup.SHOULDERS}>כתפיים</option>
                    <option value={MuscleGroup.CORE}>בטן וליבה</option>
                    <option value={MuscleGroup.FUNCTIONAL}>פונקציונלי</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {/* DATE & TIME & DURATION */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">תאריך</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border border-slate-300 rounded-xl p-2 text-xs font-bold focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">שעת התחלה</label>
              <input
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full border border-slate-300 rounded-xl p-2 text-xs font-bold focus:outline-none focus:border-emerald-500"
              />
            </div>
            {isSession ? (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">משך (דקות)</label>
                <input
                  type="number"
                  min="15"
                  max="180"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded-xl p-2 text-xs font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">מקסימום משתתפים</label>
                <input
                  type="number"
                  min="1"
                  value={maxParticipants}
                  onChange={(e) => setMaxParticipants(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded-xl p-2 text-xs font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}
          </div>

          {/* MAX PARTICIPANTS & LIMITS FOR SESSION */}
          {isSession && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">מקסימום משתתפים</label>
                  <input
                    type="number"
                    min="1"
                    value={maxParticipants}
                    onChange={(e) => setMaxParticipants(Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-xl p-2 text-xs font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">גיל מינימלי</label>
                  <input
                    type="number"
                    placeholder="ללא"
                    value={ageMin}
                    onChange={(e) => setAgeMin(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl p-2 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">גיל מקסימלי</label>
                  <input
                    type="number"
                    placeholder="ללא"
                    value={ageMax}
                    onChange={(e) => setAgeMax(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl p-2 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* GENDER RESTRICTION */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">הגבלת מין</label>
                <div className="flex gap-2">
                  {[
                    { id: Gender.ALL, label: 'כולם' },
                    { id: Gender.MALE, label: 'גברים בלבד' },
                    { id: Gender.FEMALE, label: 'נשים בלבד' }
                  ].map(g => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setGenderRestriction(g.id)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
                        genderRestriction === g.id
                          ? 'bg-emerald-600 text-white border-emerald-700'
                          : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ALLOWED MEMBERSHIPS */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">מנויים מורשים להרשמה</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {CURRENT_MEMBERSHIP_CATALOG.map(mType => {
                    const isChecked = allowedMemberships.includes(mType);
                    return (
                      <label
                        key={mType}
                        className={`flex items-center gap-2 p-1.5 rounded-lg border text-[11px] font-bold cursor-pointer transition ${
                          isChecked
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                            : 'bg-slate-50 border-slate-200 text-slate-500'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleMembership(mType)}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>{MEMBERSHIP_TYPE_LABELS[mType].label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* BUTTONS */}
          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition cursor-pointer"
            >
              ביטול
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-md transition cursor-pointer"
            >
              💾 שמור שינויים
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
