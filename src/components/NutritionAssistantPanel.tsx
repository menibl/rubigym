import React, { useState } from 'react';
import { Apple, Bot, Send, Sparkles } from 'lucide-react';
import { NutritionAssistantMessage, NutritionMealCategory, TraineeProfessionalProfile, User } from '../types';

interface NutritionAssistantPanelProps {
  trainee: User;
  profile?: TraineeProfessionalProfile;
  dailyCalories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  messages: NutritionAssistantMessage[];
  onUpdateMessages: (messages: NutritionAssistantMessage[]) => void;
  onApplyCategories: (categories: NutritionMealCategory[]) => void;
}

const buildMealSuggestions = (calories: number, protein: number, carbs: number, fat: number): NutritionMealCategory[] => {
  const allocations = [
    { title: 'ארוחת בוקר', time: '07:00–09:00', ratio: 0.25, foods: 'מקור חלבון, דגן מלא, ירק ופרי' },
    { title: 'ארוחת צהריים', time: '12:00–15:00', ratio: 0.35, foods: 'חלבון רזה, פחמימה מורכבת וסלט גדול' },
    { title: 'ארוחת ביניים', time: '16:00–18:00', ratio: 0.15, foods: 'יוגורט/תחליף, פרי ומנת שומן איכותי' },
    { title: 'ארוחת ערב', time: '19:00–21:00', ratio: 0.25, foods: 'חלבון, ירקות ופחמימה בהתאם ליעד היומי' }
  ];
  return allocations.map((meal, index) => ({
    id: `meal-${Date.now()}-${index}`,
    title: meal.title,
    suggestedTime: meal.time,
    foods: meal.foods,
    calories: Math.round(calories * meal.ratio),
    proteinGrams: Math.round(protein * meal.ratio),
    carbsGrams: Math.round(carbs * meal.ratio),
    fatGrams: Math.round(fat * meal.ratio),
    notes: 'טיוטה לעדכון ואישור מקצועי של המאמן.'
  }));
};

export const NutritionAssistantPanel: React.FC<NutritionAssistantPanelProps> = ({
  trainee,
  profile,
  dailyCalories,
  proteinGrams,
  carbsGrams,
  fatGrams,
  messages,
  onUpdateMessages,
  onApplyCategories
}) => {
  const [input, setInput] = useState('');

  const handleSend = (event: React.FormEvent) => {
    event.preventDefault();
    const prompt = input.trim();
    if (!prompt) return;
    const coachMessage: NutritionAssistantMessage = { id: `nutrition-coach-${Date.now()}`, role: 'COACH', content: prompt, createdAt: new Date().toISOString() };
    const assistantMessage: NutritionAssistantMessage = {
      id: `nutrition-assistant-${Date.now()}`,
      role: 'ASSISTANT',
      createdAt: new Date().toISOString(),
      content: `הכנתי חלוקה מוצעת של ${dailyCalories} קלוריות ל־4 ארוחות, עם ${proteinGrams} גרם חלבון, ${carbsGrams} גרם פחמימה ו־${fatGrams} גרם שומן. התחשבתי במטרה: ${profile?.primaryGoal || 'טרם הוגדרה'}. יש לבדוק רגישויות, תרופות ומגבלות לפני הפרסום.`
    };
    onUpdateMessages([...messages, coachMessage, assistantMessage]);
    onApplyCategories(buildMealSuggestions(dailyCalories, proteinGrams, carbsGrams, fatGrams));
    setInput('');
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-white" dir="rtl">
      <div className="flex items-center justify-between gap-3 bg-gradient-to-l from-emerald-950 to-slate-900 p-4 text-white">
        <div className="flex items-center gap-3"><Bot size={22} className="text-emerald-300" /><div><h4 className="text-sm font-black">עוזר בניית תוכנית תזונה</h4><p className="text-[11px] text-slate-300">נתוני {trainee.name} · גיל {trainee.age} · מטרה {profile?.primaryGoal || 'לא הוגדרה'}</p></div></div>
        <span className="rounded-full bg-amber-300 px-2 py-1 text-[9px] font-black text-slate-900">DEMO מקומי</span>
      </div>
      <div className="grid gap-4 p-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl bg-slate-50 p-3">
          {messages.length === 0 && <div className="py-8 text-center text-xs text-slate-500"><Sparkles className="mx-auto mb-2 text-emerald-500" /><strong className="block">כתוב יעד, העדפות ומגבלות</strong>העוזר יחלק את המאקרו לארוחות לעריכת המאמן.</div>}
          {messages.map(message => <div key={message.id} className={`rounded-xl p-3 text-xs leading-5 ${message.role === 'COACH' ? 'mr-6 bg-slate-900 text-white' : 'ml-6 border border-emerald-100 bg-white text-slate-700'}`}><strong className="mb-1 block text-[9px]">{message.role === 'COACH' ? 'המאמן' : 'עוזר התזונה'}</strong>{message.content}</div>)}
        </div>
        <div>
          <div className="mb-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
            {[['קלוריות', dailyCalories], ['חלבון', `${proteinGrams}g`], ['פחמימה', `${carbsGrams}g`], ['שומן', `${fatGrams}g`]].map(([label, value]) => <div key={label} className="rounded-lg border border-emerald-100 bg-emerald-50 p-2"><small className="block text-[9px] text-emerald-700">{label}</small><b className="text-xs text-slate-900">{value}</b></div>)}
          </div>
          <form onSubmit={handleSend} className="space-y-2">
            <textarea value={input} onChange={event => setInput(event.target.value)} rows={4} placeholder="לדוגמה: בנה תוכנית לירידה במשקל, 4 ארוחות, ללא חלב ועם ארוחה לפני אימון ערב" className="w-full rounded-xl border border-slate-300 p-3 text-xs" />
            <button disabled={!input.trim()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white disabled:opacity-40"><Send size={15} /> צור חלוקת ארוחות לעריכה</button>
          </form>
          <p className="mt-2 flex items-center gap-1 text-[9px] text-slate-500"><Apple size={12} /> ההצעה אינה מתפרסמת עד שהמאמן עורך ושומר אותה.</p>
        </div>
      </div>
    </section>
  );
};
