import React, { useEffect, useState } from 'react';
import { Check, Plus, Wrench } from 'lucide-react';
import { GymEquipment, MuscleGroup, User } from '../types';

interface AiEquipmentSelectorProps {
  activeUser: User;
  equipment: GymEquipment[];
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
  onUpdateEquipment: (equipment: GymEquipment[]) => void;
}

export const AiEquipmentSelector: React.FC<AiEquipmentSelectorProps> = ({ activeUser, equipment, selectedIds, onSelectedIdsChange, onUpdateEquipment }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('מכשיר כוח');
  const available = equipment.filter(item => item.status !== 'OUT_OF_SERVICE' && item.quantity > 0);

  useEffect(() => {
    if (selectedIds.length === 0 && available.length > 0) onSelectedIdsChange(available.map(item => item.id));
  }, [equipment.length]);

  const addEquipment = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    const item: GymEquipment = {
      id: `equipment-${Date.now()}`,
      name: name.trim(),
      category: category.trim() || 'ציוד',
      aliases: [],
      muscleGroups: [MuscleGroup.FUNCTIONAL],
      quantity: 1,
      location: '',
      status: 'AVAILABLE',
      notes: 'נוסף מתוך עוזר הבנייה החכם',
      updatedAt: new Date().toISOString(),
      updatedById: activeUser.id,
      updatedByName: activeUser.name
    };
    onUpdateEquipment([item, ...equipment]);
    onSelectedIdsChange([...selectedIds, item.id]);
    setName('');
    setShowAdd(false);
  };

  return <div className="space-y-3">
    <div className="flex items-center justify-between gap-2"><div><h4 className="text-xs font-black text-white">ציוד שעליו יתבסס האימון</h4><p className="mt-1 text-[9px] text-zinc-400">כל המכשירים הזמינים נבחרים כברירת מחדל, והעוזר יעדיף לשלב אותם. ניתן לבטל בחירה.</p></div><button type="button" onClick={() => setShowAdd(value => !value)} className="flex min-h-9 items-center gap-1 rounded-lg bg-amber-400 px-3 text-[10px] font-black text-zinc-950"><Plus size={13} /> הוסף</button></div>
    {showAdd && <form onSubmit={addEquipment} className="space-y-2 rounded-xl border border-amber-400/30 bg-amber-400/5 p-3"><input autoFocus value={name} onChange={event => setName(event.target.value)} placeholder="שם המכשיר" className="min-h-10 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 text-xs text-white" /><input value={category} onChange={event => setCategory(event.target.value)} placeholder="קטגוריה" className="min-h-10 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 text-xs text-white" /><button className="min-h-10 w-full rounded-lg bg-emerald-500 text-xs font-black text-white">שמירה ובחירה לאימון</button></form>}
    <div className="flex gap-2"><button type="button" onClick={() => onSelectedIdsChange(available.map(item => item.id))} className="rounded-lg bg-white/5 px-3 py-2 text-[9px] font-bold text-zinc-300">בחר הכול</button><button type="button" onClick={() => onSelectedIdsChange([])} className="rounded-lg bg-white/5 px-3 py-2 text-[9px] font-bold text-zinc-300">ללא ציוד</button></div>
    <div className="space-y-2">{available.map(item => {
      const selected = selectedIds.includes(item.id);
      return <button key={item.id} type="button" onClick={() => onSelectedIdsChange(selected ? selectedIds.filter(id => id !== item.id) : [...selectedIds, item.id])} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-right ${selected ? 'border-emerald-400 bg-emerald-400/10' : 'border-white/10 bg-white/5'}`}><span className="grid h-8 w-8 place-items-center rounded-lg bg-white/5">{selected ? <Check size={15} className="text-emerald-300" /> : <Wrench size={15} className="text-zinc-500" />}</span><span className="min-w-0 flex-1"><strong className="block truncate text-xs text-white">{item.name}</strong><small className="text-[9px] text-zinc-400">{item.category} · כמות {item.quantity}</small></span></button>;
    })}{available.length === 0 && <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-[11px] text-zinc-500">אין ציוד זמין. הוסף מכשיר כדי שהעוזר יוכל להשתמש בו.</p>}</div>
  </div>;
};
