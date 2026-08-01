import React, { useMemo, useState } from 'react';
import { CheckCircle2, CircleOff, Dumbbell, MapPin, Pencil, Plus, Search, Trash2, Wrench } from 'lucide-react';
import { GymEquipment, GymEquipmentStatus, MuscleGroup, User } from '../types';

interface GymEquipmentPanelProps {
  activeUser: User;
  equipment: GymEquipment[];
  onUpdateEquipment: (equipment: GymEquipment[]) => void;
}

const STATUS_LABELS: Record<GymEquipmentStatus, string> = {
  AVAILABLE: 'זמין',
  LIMITED: 'זמינות מוגבלת',
  OUT_OF_SERVICE: 'לא בשימוש'
};

const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  UPPER: 'פלג גוף עליון',
  LEGS: 'רגליים וישבן',
  BACK: 'גב',
  SHOULDERS: 'כתפיים',
  CORE: 'בטן וליבה',
  FUNCTIONAL: 'פונקציונלי'
};

const emptyDraft = {
  name: '',
  category: '',
  aliases: '',
  muscleGroups: [] as MuscleGroup[],
  quantity: 1,
  location: '',
  status: 'AVAILABLE' as GymEquipmentStatus,
  notes: ''
};

export const GymEquipmentPanel: React.FC<GymEquipmentPanelProps> = ({ activeUser, equipment, onUpdateEquipment }) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | GymEquipmentStatus>('ALL');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState(emptyDraft);

  const filteredEquipment = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return equipment.filter(item => {
      const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;
      const matchesSearch = !normalized || [item.name, item.category, item.location, ...item.aliases]
        .some(value => value.toLowerCase().includes(normalized));
      return matchesStatus && matchesSearch;
    });
  }, [equipment, search, statusFilter]);

  const availableCount = equipment.filter(item => item.status === 'AVAILABLE').length;
  const totalUnits = equipment.reduce((sum, item) => sum + item.quantity, 0);

  const resetForm = () => {
    setDraft(emptyDraft);
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (item: GymEquipment) => {
    setEditingId(item.id);
    setDraft({
      name: item.name,
      category: item.category,
      aliases: item.aliases.join(', '),
      muscleGroups: item.muscleGroups,
      quantity: item.quantity,
      location: item.location,
      status: item.status,
      notes: item.notes
    });
    setShowForm(true);
  };

  const saveEquipment = (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim() || !draft.category.trim()) return;
    const now = new Date().toISOString();
    const item: GymEquipment = {
      id: editingId || `equipment-${Date.now()}`,
      name: draft.name.trim(),
      category: draft.category.trim(),
      aliases: draft.aliases.split(',').map(alias => alias.trim()).filter(Boolean),
      muscleGroups: draft.muscleGroups,
      quantity: Math.max(1, Number(draft.quantity) || 1),
      location: draft.location.trim(),
      status: draft.status,
      notes: draft.notes.trim(),
      updatedAt: now,
      updatedById: activeUser.id,
      updatedByName: activeUser.name
    };
    onUpdateEquipment(editingId
      ? equipment.map(current => current.id === editingId ? item : current)
      : [item, ...equipment]);
    resetForm();
  };

  const toggleMuscleGroup = (muscleGroup: MuscleGroup) => {
    setDraft(current => ({
      ...current,
      muscleGroups: current.muscleGroups.includes(muscleGroup)
        ? current.muscleGroups.filter(group => group !== muscleGroup)
        : [...current.muscleGroups, muscleGroup]
    }));
  };

  const changeStatus = (item: GymEquipment, status: GymEquipmentStatus) => {
    onUpdateEquipment(equipment.map(current => current.id === item.id ? {
      ...current,
      status,
      updatedAt: new Date().toISOString(),
      updatedById: activeUser.id,
      updatedByName: activeUser.name
    } : current));
  };

  const deleteEquipment = (item: GymEquipment) => {
    if (!confirm(`למחוק את ${item.name} ממאגר הציוד?`)) return;
    onUpdateEquipment(equipment.filter(current => current.id !== item.id));
  };

  return (
    <div className="space-y-5" dir="rtl">
      <section className="rounded-2xl bg-slate-950 text-white p-5 sm:p-6 border border-sky-500/20">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sky-300"><Wrench size={18} /><span className="text-xs font-bold">בסיס ידע לעוזר האימון</span></div>
            <h3 className="text-xl sm:text-2xl font-black mt-2">מכשירים וציוד בחדר הכושר</h3>
            <p className="text-xs text-slate-400 mt-2 max-w-2xl">רק ציוד שמסומן כזמין ישמש בעתיד את הצ׳אט לבניית תוכניות. ניתן להשבית מכשיר זמנית בלי למחוק אותו.</p>
          </div>
          <button onClick={() => { setEditingId(null); setDraft(emptyDraft); setShowForm(true); }} className="rounded-xl bg-sky-600 hover:bg-sky-500 px-4 py-2.5 text-xs font-bold flex items-center justify-center gap-2">
            <Plus size={15} /> הוספת מכשיר או ציוד
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-5 max-w-lg">
          <div className="rounded-xl bg-white/5 border border-white/10 p-3"><span className="block text-[9px] text-slate-400">סוגי ציוד</span><b className="text-lg">{equipment.length}</b></div>
          <div className="rounded-xl bg-white/5 border border-white/10 p-3"><span className="block text-[9px] text-slate-400">זמינים</span><b className="text-lg text-emerald-400">{availableCount}</b></div>
          <div className="rounded-xl bg-white/5 border border-white/10 p-3"><span className="block text-[9px] text-slate-400">יחידות</span><b className="text-lg">{totalUnits}</b></div>
        </div>
      </section>

      {showForm && (
        <form onSubmit={saveEquipment} className="rounded-2xl border border-sky-200 bg-sky-50 p-4 sm:p-5 space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="font-black text-sm text-slate-900">{editingId ? 'עריכת ציוד' : 'הוספת ציוד חדש'}</h4>
            <button type="button" onClick={resetForm} className="text-xs text-slate-500">ביטול</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <label className="grid gap-1 text-[10px] font-bold text-slate-600">שם המכשיר או הציוד<input required value={draft.name} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} placeholder="למשל: מכונת לחיצת חזה" className="rounded-lg border border-slate-200 p-2.5 font-normal bg-white" /></label>
            <label className="grid gap-1 text-[10px] font-bold text-slate-600">קטגוריה<input required value={draft.category} onChange={event => setDraft(current => ({ ...current, category: event.target.value }))} placeholder="מכונה, משקולות, אירובי..." className="rounded-lg border border-slate-200 p-2.5 font-normal bg-white" /></label>
            <label className="grid gap-1 text-[10px] font-bold text-slate-600">שמות חלופיים<input value={draft.aliases} onChange={event => setDraft(current => ({ ...current, aliases: event.target.value }))} placeholder="Chest Press, לחיצת חזה" className="rounded-lg border border-slate-200 p-2.5 font-normal bg-white" /><small className="text-[8px] font-normal text-slate-400">יש להפריד בפסיקים</small></label>
            <label className="grid gap-1 text-[10px] font-bold text-slate-600">כמות<input type="number" min={1} value={draft.quantity} onChange={event => setDraft(current => ({ ...current, quantity: Number(event.target.value) }))} className="rounded-lg border border-slate-200 p-2.5 font-normal bg-white" /></label>
            <label className="grid gap-1 text-[10px] font-bold text-slate-600">מיקום<input value={draft.location} onChange={event => setDraft(current => ({ ...current, location: event.target.value }))} placeholder="אזור כוח, קומה 1..." className="rounded-lg border border-slate-200 p-2.5 font-normal bg-white" /></label>
            <label className="grid gap-1 text-[10px] font-bold text-slate-600">סטטוס<select value={draft.status} onChange={event => setDraft(current => ({ ...current, status: event.target.value as GymEquipmentStatus }))} className="rounded-lg border border-slate-200 p-2.5 font-normal bg-white"><option value="AVAILABLE">זמין</option><option value="LIMITED">זמינות מוגבלת</option><option value="OUT_OF_SERVICE">לא בשימוש</option></select></label>
          </div>
          <fieldset>
            <legend className="text-[10px] font-bold text-slate-600 mb-2">קבוצות שרירים רלוונטיות</legend>
            <div className="flex flex-wrap gap-2">{Object.entries(MUSCLE_LABELS).map(([value, label]) => <button key={value} type="button" onClick={() => toggleMuscleGroup(value as MuscleGroup)} className={`rounded-full border px-2.5 py-1 text-[9px] ${draft.muscleGroups.includes(value as MuscleGroup) ? 'bg-sky-700 border-sky-700 text-white' : 'bg-white border-slate-200 text-slate-600'}`}>{label}</button>)}</div>
          </fieldset>
          <label className="grid gap-1 text-[10px] font-bold text-slate-600">הערות לצוות ולעוזר<textarea rows={2} value={draft.notes} onChange={event => setDraft(current => ({ ...current, notes: event.target.value }))} placeholder="אביזרים נלווים, מגבלות שימוש או מידע חשוב..." className="rounded-lg border border-slate-200 p-2.5 font-normal bg-white" /></label>
          <div className="flex justify-end"><button className="rounded-xl bg-slate-950 text-white px-5 py-2.5 text-xs font-bold">{editingId ? 'שמירת שינויים' : 'הוספה למאגר'}</button></div>
        </form>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <label className="relative flex-1"><Search size={15} className="absolute right-3 top-2.5 text-slate-400" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="חיפוש לפי שם, קטגוריה, מיקום או שם חלופי" className="w-full rounded-xl border border-slate-200 py-2 pr-9 pl-3 text-xs" /></label>
          <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as 'ALL' | GymEquipmentStatus)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs"><option value="ALL">כל הסטטוסים</option><option value="AVAILABLE">זמין</option><option value="LIMITED">זמינות מוגבלת</option><option value="OUT_OF_SERVICE">לא בשימוש</option></select>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filteredEquipment.map(item => (
            <article key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div className="flex gap-2"><div className="rounded-lg bg-white border border-slate-200 p-2 h-fit"><Dumbbell size={16} className="text-sky-700" /></div><div><h4 className="font-black text-sm text-slate-900">{item.name}</h4><span className="text-[9px] text-slate-500">{item.category} · כמות {item.quantity}</span></div></div>
                <span className={`rounded-full px-2 py-1 text-[8px] font-bold ${item.status === 'AVAILABLE' ? 'bg-emerald-100 text-emerald-800' : item.status === 'LIMITED' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>{STATUS_LABELS[item.status]}</span>
              </div>
              {item.location && <div className="flex items-center gap-1 text-[9px] text-slate-500 mt-3"><MapPin size={11} /> {item.location}</div>}
              {item.muscleGroups.length > 0 && <div className="flex flex-wrap gap-1 mt-3">{item.muscleGroups.map(group => <span key={group} className="rounded bg-sky-100 text-sky-800 px-1.5 py-0.5 text-[8px]">{MUSCLE_LABELS[group]}</span>)}</div>}
              {item.aliases.length > 0 && <p className="text-[9px] text-slate-400 mt-2">שמות נוספים: {item.aliases.join(', ')}</p>}
              {item.notes && <p className="text-[10px] text-slate-600 mt-2 leading-5 flex-1">{item.notes}</p>}
              <div className="flex items-center justify-between gap-2 border-t border-slate-200 mt-3 pt-3">
                <div className="flex gap-1">
                  <button onClick={() => changeStatus(item, item.status === 'AVAILABLE' ? 'OUT_OF_SERVICE' : 'AVAILABLE')} className={`rounded-lg p-2 ${item.status === 'AVAILABLE' ? 'text-red-600 bg-red-50' : 'text-emerald-700 bg-emerald-50'}`} title={item.status === 'AVAILABLE' ? 'סימון כלא זמין' : 'החזרה לזמינות'}>{item.status === 'AVAILABLE' ? <CircleOff size={14} /> : <CheckCircle2 size={14} />}</button>
                  <button onClick={() => startEdit(item)} className="rounded-lg p-2 text-sky-700 bg-sky-50" title="עריכה"><Pencil size={14} /></button>
                </div>
                <button onClick={() => deleteEquipment(item)} className="rounded-lg p-2 text-slate-400 hover:text-red-600" title="מחיקה"><Trash2 size={14} /></button>
              </div>
              <small className="text-[8px] text-slate-400 mt-2">עודכן על ידי {item.updatedByName} · {new Date(item.updatedAt).toLocaleDateString('he-IL')}</small>
            </article>
          ))}
          {filteredEquipment.length === 0 && <div className="md:col-span-2 xl:col-span-3 rounded-xl border border-dashed border-slate-200 text-center p-10 text-xs text-slate-400">{equipment.length === 0 ? 'עדיין לא הוזנו מכשירים. הוסף את הציוד הקיים במועדון.' : 'לא נמצאו מכשירים התואמים לחיפוש.'}</div>}
        </div>
      </section>
    </div>
  );
};
