import React, { useEffect, useMemo, useState } from 'react';
import { Brain, Check, LockKeyhole, Pencil, Plus, Save, ShieldAlert, Trash2, UserRound } from 'lucide-react';
import {
  Gender,
  TraineeMemoryCategory,
  TraineeMemoryEntry,
  TraineeMemoryVisibility,
  TraineeProfessionalProfile,
  User
} from '../types';

interface TraineeMemoryPanelProps {
  trainee: User;
  activeUser: User;
  profile?: TraineeProfessionalProfile;
  entries: TraineeMemoryEntry[];
  onSaveProfile: (profile: TraineeProfessionalProfile) => void;
  onAddEntry: (entry: TraineeMemoryEntry) => void;
  onDeleteEntry: (entryId: string) => void;
}

const CATEGORY_LABELS: Record<TraineeMemoryCategory, string> = {
  GOAL: 'מטרה',
  LIMITATION: 'מגבלה',
  PREFERENCE: 'העדפה',
  PROGRESS: 'התקדמות',
  COACH_NOTE: 'הערת מאמן'
};

const createProfileDraft = (trainee: User, activeUser: User, profile?: TraineeProfessionalProfile): TraineeProfessionalProfile => profile || ({
  traineeId: trainee.id,
  primaryGoal: '',
  secondaryGoals: '',
  experienceLevel: 'BEGINNER',
  weeklySessions: 3,
  preferredWorkoutMinutes: 60,
  limitations: '',
  painAreas: '',
  prohibitedExercises: '',
  preferredExercises: '',
  equipmentPreferences: '',
  coachSummary: '',
  updatedAt: new Date().toISOString(),
  updatedById: activeUser.id,
  updatedByName: activeUser.name
});

export const TraineeMemoryPanel: React.FC<TraineeMemoryPanelProps> = ({
  trainee,
  activeUser,
  profile,
  entries,
  onSaveProfile,
  onAddEntry,
  onDeleteEntry
}) => {
  const [isEditing, setIsEditing] = useState(!profile);
  const [draft, setDraft] = useState<TraineeProfessionalProfile>(() => createProfileDraft(trainee, activeUser, profile));
  const [newEntry, setNewEntry] = useState({
    category: 'COACH_NOTE' as TraineeMemoryCategory,
    content: '',
    visibility: 'TEAM' as TraineeMemoryVisibility
  });

  useEffect(() => {
    setDraft(createProfileDraft(trainee, activeUser, profile));
    setIsEditing(!profile);
    setNewEntry({ category: 'COACH_NOTE', content: '', visibility: 'TEAM' });
  }, [trainee.id, profile, activeUser.id, activeUser.name]);

  const visibleEntries = useMemo(() => entries
    .filter(entry => entry.visibility === 'TEAM' || entry.createdById === activeUser.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [entries, activeUser.id]);

  const saveProfile = () => {
    onSaveProfile({
      ...draft,
      traineeId: trainee.id,
      updatedAt: new Date().toISOString(),
      updatedById: activeUser.id,
      updatedByName: activeUser.name
    });
    setIsEditing(false);
  };

  const addMemory = (event: React.FormEvent) => {
    event.preventDefault();
    if (!newEntry.content.trim()) return;
    onAddEntry({
      id: `memory-${Date.now()}`,
      traineeId: trainee.id,
      category: newEntry.category,
      content: newEntry.content.trim(),
      visibility: newEntry.visibility,
      confirmed: true,
      createdAt: new Date().toISOString(),
      createdById: activeUser.id,
      createdByName: activeUser.name
    });
    setNewEntry(current => ({ ...current, content: '' }));
  };

  const updateDraft = <K extends keyof TraineeProfessionalProfile>(key: K, value: TraineeProfessionalProfile[K]) => {
    setDraft(current => ({ ...current, [key]: value }));
  };

  return (
    <section className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white overflow-hidden" dir="rtl">
      <div className="p-4 sm:p-5 border-b border-sky-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sky-900">
            <Brain size={19} />
            <h4 className="font-black text-sm">זיכרון מקצועי — {trainee.name}</h4>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">בסיס המידע המאושר שישמש בהמשך את עוזר בניית התוכנית.</p>
        </div>
        <button
          type="button"
          onClick={() => isEditing ? saveProfile() : setIsEditing(true)}
          className="rounded-xl bg-slate-950 text-white px-3.5 py-2 text-xs font-bold flex items-center justify-center gap-1.5"
        >
          {isEditing ? <><Save size={14} /> שמירת פרופיל מקצועי</> : <><Pencil size={14} /> עריכת הזיכרון</>}
        </button>
      </div>

      <div className="p-4 sm:p-5 grid grid-cols-1 xl:grid-cols-[0.8fr_1.2fr] gap-5">
        <div className="space-y-4">
          <article className="rounded-xl bg-white border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-3"><UserRound size={16} className="text-sky-700" /><strong className="text-xs text-slate-900">נתוני בסיס מהמשתמש</strong></div>
            <dl className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-lg bg-slate-50 p-2"><dt className="text-slate-400">גיל</dt><dd className="font-bold mt-0.5">{trainee.age}</dd></div>
              <div className="rounded-lg bg-slate-50 p-2"><dt className="text-slate-400">מין</dt><dd className="font-bold mt-0.5">{trainee.gender === Gender.FEMALE ? 'אישה' : trainee.gender === Gender.MALE ? 'גבר' : 'לא הוגדר'}</dd></div>
              <div className="rounded-lg bg-slate-50 p-2"><dt className="text-slate-400">מסלול</dt><dd className="font-bold mt-0.5">{trainee.membershipType || 'לא הוגדר'}</dd></div>
              <div className="rounded-lg bg-slate-50 p-2"><dt className="text-slate-400">הצהרת בריאות</dt><dd className={`font-bold mt-0.5 ${trainee.healthDeclarationSigned ? 'text-emerald-700' : 'text-red-700'}`}>{trainee.healthDeclarationSigned ? 'חתומה' : 'לא חתומה'}</dd></div>
            </dl>
          </article>

          <article className="rounded-xl bg-amber-50 border border-amber-200 p-3 flex gap-2 text-[10px] text-amber-900 leading-5">
            <ShieldAlert size={16} className="shrink-0 mt-0.5" />
            מידע רפואי או מגבלה חדשים נשמרים רק לאחר אישור מפורש של המאמן. המתאמן אינו רואה הערות פנימיות.
          </article>
        </div>

        <div className="space-y-4">
          <article className="rounded-xl bg-white border border-slate-200 p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="grid gap-1 text-[10px] font-bold text-slate-600">מטרה עיקרית<input disabled={!isEditing} value={draft.primaryGoal} onChange={event => updateDraft('primaryGoal', event.target.value)} placeholder="למשל: חיזוק וירידה במשקל" className="rounded-lg border border-slate-200 p-2.5 disabled:bg-slate-50 disabled:text-slate-700 font-normal" /></label>
              <label className="grid gap-1 text-[10px] font-bold text-slate-600">מטרות נוספות<input disabled={!isEditing} value={draft.secondaryGoals} onChange={event => updateDraft('secondaryGoals', event.target.value)} placeholder="כושר אירובי, גמישות..." className="rounded-lg border border-slate-200 p-2.5 disabled:bg-slate-50 disabled:text-slate-700 font-normal" /></label>
              <label className="grid gap-1 text-[10px] font-bold text-slate-600">רמת ניסיון<select disabled={!isEditing} value={draft.experienceLevel} onChange={event => updateDraft('experienceLevel', event.target.value as TraineeProfessionalProfile['experienceLevel'])} className="rounded-lg border border-slate-200 p-2.5 disabled:bg-slate-50 font-normal"><option value="BEGINNER">מתחיל</option><option value="INTERMEDIATE">ביניים</option><option value="ADVANCED">מתקדם</option></select></label>
              <div className="grid grid-cols-2 gap-2">
                <label className="grid gap-1 text-[10px] font-bold text-slate-600">אימונים בשבוע<input disabled={!isEditing} type="number" min={1} max={7} value={draft.weeklySessions} onChange={event => updateDraft('weeklySessions', Number(event.target.value))} className="rounded-lg border border-slate-200 p-2.5 disabled:bg-slate-50 font-normal" /></label>
                <label className="grid gap-1 text-[10px] font-bold text-slate-600">משך בדקות<input disabled={!isEditing} type="number" min={15} max={180} step={5} value={draft.preferredWorkoutMinutes} onChange={event => updateDraft('preferredWorkoutMinutes', Number(event.target.value))} className="rounded-lg border border-slate-200 p-2.5 disabled:bg-slate-50 font-normal" /></label>
              </div>
              <label className="grid gap-1 text-[10px] font-bold text-slate-600 sm:col-span-2">מגבלות תנועה<textarea disabled={!isEditing} rows={2} value={draft.limitations} onChange={event => updateDraft('limitations', event.target.value)} placeholder="טווחי תנועה, מגבלות שאושרו..." className="rounded-lg border border-slate-200 p-2.5 disabled:bg-slate-50 font-normal" /></label>
              <label className="grid gap-1 text-[10px] font-bold text-slate-600">כאבים או רגישויות<textarea disabled={!isEditing} rows={2} value={draft.painAreas} onChange={event => updateDraft('painAreas', event.target.value)} className="rounded-lg border border-slate-200 p-2.5 disabled:bg-slate-50 font-normal" /></label>
              <label className="grid gap-1 text-[10px] font-bold text-slate-600">תרגילים אסורים<textarea disabled={!isEditing} rows={2} value={draft.prohibitedExercises} onChange={event => updateDraft('prohibitedExercises', event.target.value)} className="rounded-lg border border-slate-200 p-2.5 disabled:bg-slate-50 font-normal" /></label>
              <label className="grid gap-1 text-[10px] font-bold text-slate-600">תרגילים מועדפים<textarea disabled={!isEditing} rows={2} value={draft.preferredExercises} onChange={event => updateDraft('preferredExercises', event.target.value)} className="rounded-lg border border-slate-200 p-2.5 disabled:bg-slate-50 font-normal" /></label>
              <label className="grid gap-1 text-[10px] font-bold text-slate-600">העדפות ציוד<textarea disabled={!isEditing} rows={2} value={draft.equipmentPreferences} onChange={event => updateDraft('equipmentPreferences', event.target.value)} className="rounded-lg border border-slate-200 p-2.5 disabled:bg-slate-50 font-normal" /></label>
              <label className="grid gap-1 text-[10px] font-bold text-slate-600 sm:col-span-2">תקציר מקצועי למאמן ולעוזר<textarea disabled={!isEditing} rows={3} value={draft.coachSummary} onChange={event => updateDraft('coachSummary', event.target.value)} placeholder="סיכום קצר של הדברים החשובים לבניית התוכנית" className="rounded-lg border border-slate-200 p-2.5 disabled:bg-slate-50 font-normal" /></label>
            </div>
            {!isEditing && profile && <p className="text-[9px] text-slate-400 mt-3">עודכן לאחרונה על ידי {profile.updatedByName} בתאריך {new Date(profile.updatedAt).toLocaleDateString('he-IL')}</p>}
          </article>

          <article className="rounded-xl bg-white border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <strong className="text-xs text-slate-900">עובדות והערות מאושרות</strong>
              <span className="text-[9px] rounded-full bg-sky-100 text-sky-800 px-2 py-1">{visibleEntries.length} פריטים</span>
            </div>
            <form onSubmit={addMemory} className="grid grid-cols-1 sm:grid-cols-[130px_1fr_130px_auto] gap-2 mb-3">
              <select value={newEntry.category} onChange={event => setNewEntry(current => ({ ...current, category: event.target.value as TraineeMemoryCategory }))} className="rounded-lg border border-slate-200 p-2 text-[10px]">{Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
              <input value={newEntry.content} onChange={event => setNewEntry(current => ({ ...current, content: event.target.value }))} placeholder="הוסף עובדה או הערה לזיכרון..." className="rounded-lg border border-slate-200 p-2 text-[10px]" />
              <select value={newEntry.visibility} onChange={event => setNewEntry(current => ({ ...current, visibility: event.target.value as TraineeMemoryVisibility }))} className="rounded-lg border border-slate-200 p-2 text-[10px]"><option value="TEAM">משותף לצוות</option><option value="PRIVATE_COACH">פרטי למאמן</option></select>
              <button className="rounded-lg bg-sky-700 text-white px-3 py-2 flex items-center justify-center" title="הוספת פריט לזיכרון"><Plus size={14} /></button>
            </form>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {visibleEntries.map(entry => (
                <div key={entry.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3 flex gap-3 items-start">
                  <Check size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5"><span className="text-[9px] font-bold text-sky-800 bg-sky-100 rounded px-1.5 py-0.5">{CATEGORY_LABELS[entry.category]}</span>{entry.visibility === 'PRIVATE_COACH' && <span className="text-[9px] text-slate-500 flex items-center gap-1"><LockKeyhole size={10} /> פרטי</span>}</div>
                    <p className="text-[11px] text-slate-700 mt-1 leading-5">{entry.content}</p>
                    <small className="text-[9px] text-slate-400">{entry.createdByName} · {new Date(entry.createdAt).toLocaleDateString('he-IL')}</small>
                  </div>
                  {(entry.createdById === activeUser.id || activeUser.role === 'MANAGER') && <button type="button" onClick={() => onDeleteEntry(entry.id)} className="text-slate-400 hover:text-red-600" title="מחיקת פריט"><Trash2 size={13} /></button>}
                </div>
              ))}
              {visibleEntries.length === 0 && <div className="text-center text-[10px] text-slate-400 border border-dashed border-slate-200 rounded-lg p-5">עדיין לא נשמרו עובדות או הערות מקצועיות.</div>}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
};
