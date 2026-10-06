import React, { useState } from 'react';
import { User, MembershipType } from '../types';
import { updateTrainingCard } from '../../shared/training-card.js';

const cards = [
  { type: MembershipType.PERSONAL_TRAINING, label: 'אימון אישי', field: 'personalTrainingRemaining' },
  { type: MembershipType.DUO_TRAINING, label: 'אימון זוגי', field: 'duoTrainingRemaining' },
  { type: MembershipType.OPEN_PUNCH_CARD, label: 'כרטיסיית Open Gym', field: 'punchCardRemaining' }
];

export function AdminTrainingCardEditor({ user, onChange }: { user: User; onChange: (type: MembershipType, quantity: string, mode: 'ADD' | 'SET') => void }) {
  const [type, setType] = useState([MembershipType.PERSONAL_TRAINING, MembershipType.DUO_TRAINING, MembershipType.OPEN_PUNCH_CARD].includes(user.membershipType) ? user.membershipType : MembershipType.PERSONAL_TRAINING);
  const [quantity, setQuantity] = useState('1');
  const [mode, setMode] = useState<'ADD' | 'SET'>('ADD');
  const [feedback, setFeedback] = useState('');
  const card = cards.find(c => c.type === type)!;
  const assigned = [user.membershipType, ...(user.secondaryMemberships || [])].includes(type);
  return <details className="w-full rounded-xl border border-slate-600 bg-slate-900 p-3 text-right text-slate-100">
    <summary className="cursor-pointer font-bold">כרטיסיות וכמות אימונים</summary>
    <p className="my-2 text-xs text-slate-300">אישי, זוגי ו־Open Gym הן כרטיסיות נפרדות. שינוי ידני אינו חיוב או אישור תשלום.</p>
    <label className="block text-sm">סוג הכרטיסייה
      <select aria-label={`סוג כרטיסייה של ${user.name}`} value={type} onChange={e => { setType(e.target.value as MembershipType); setFeedback(''); }} className="mt-1 min-h-11 w-full rounded-lg bg-slate-800 p-2 text-white">
        {cards.map(c => <option key={c.type} value={c.type}>{c.label} — יתרה {user[c.field] ?? 0}</option>)}
      </select>
    </label>
    <label className="mt-2 block text-sm">פעולה
      <select value={mode} onChange={e => { setMode(e.target.value as 'ADD' | 'SET'); setFeedback(''); }} className="mt-1 min-h-11 w-full rounded-lg bg-slate-800 p-2 text-white">
        <option value="ADD">הוספת אימונים ליתרה הקיימת</option><option value="SET">תיקון היתרה לכמות מדויקת</option>
      </select>
    </label>
    <label className="mt-2 block text-sm">{mode === 'ADD' ? 'כמות אימונים להוספה' : 'יתרה חדשה'}
      <input type="number" inputMode="numeric" min={mode === 'ADD' ? 1 : 0} max={1000} step={1} value={quantity} onChange={e => { setQuantity(e.target.value); setFeedback(''); }} className="mt-1 min-h-11 w-full rounded-lg bg-slate-800 p-2 text-white" />
    </label>
    <p className="mt-2 text-xs text-slate-300">יתרה נוכחית ב{card.label}: {user[card.field] ?? 0}. {!assigned && 'בשמירה יתווסף סוג הכרטיסייה להרשאות, בלי להחליף את המסלול הראשי.'} תוקף וסטטוס התשלום אינם משתנים.</p>
    <button type="button" onClick={() => {
      try {
        updateTrainingCard(user, type, quantity, mode);
        onChange(type, quantity, mode);
        setFeedback('עדכון הכרטיסייה נשלח לשמירה.');
      } catch (error) { setFeedback(error.message); }
    }} className="mt-3 min-h-11 w-full rounded-lg bg-amber-400 p-2 font-bold text-slate-950">{mode === 'ADD' ? 'הוספת הכמות לכרטיסייה' : 'שמירת היתרה החדשה'}</button>
    {feedback && <p role="status" className="mt-2 text-sm">{feedback}</p>}
  </details>;
}
