import React, { useState } from 'react';
import { Apple, Bot, MessageSquareText } from 'lucide-react';
import { NutritionAssistantMessage, NutritionMealCategory, NutritionPlan, TraineeProfessionalProfile, User } from '../types';
import { generateNutritionWithAi, NutritionAiResult } from '../data/workoutAi';
import { AiBuilderChatScreen } from './AiBuilderChatScreen';

interface NutritionAssistantPanelProps {
  activeUser: User;
  trainee: User;
  profile?: TraineeProfessionalProfile;
  dailyCalories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  hydrationLiters: number;
  fiberGrams: number;
  goal: string;
  coachNotes: string;
  mealsDescription: string;
  categories: NutritionMealCategory[];
  messages: NutritionAssistantMessage[];
  libraryPlans?: NutritionPlan[];
  onUpdateMessages: (messages: NutritionAssistantMessage[]) => void;
  onApplyPlan: (plan: NutritionAiResult & { categories: NutritionMealCategory[] }) => void;
}

export const NutritionAssistantPanel: React.FC<NutritionAssistantPanelProps> = ({
  activeUser,
  trainee,
  profile,
  dailyCalories,
  proteinGrams,
  carbsGrams,
  fatGrams,
  hydrationLiters,
  fiberGrams,
  goal,
  coachNotes,
  mealsDescription,
  categories,
  messages,
  libraryPlans = [],
  onUpdateMessages,
  onApplyPlan
}) => {
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleSend = async (suggestedPrompt?: string) => {
    const prompt = (suggestedPrompt || input).trim();
    if (!prompt || isGenerating) return;
    const coachMessage: NutritionAssistantMessage = { id: `nutrition-coach-${Date.now()}`, role: 'COACH', content: prompt, createdAt: new Date().toISOString() };
    onUpdateMessages([...messages, coachMessage]);
    setInput('');
    setIsGenerating(true);
    try {
      const { result } = await generateNutritionWithAi({
        message: prompt,
        actor: activeUser,
        trainee,
        professionalProfile: profile,
        conversation: [...messages, coachMessage],
        currentDraft: { goal, dailyCalories, proteinGrams, carbsGrams, fatGrams, hydrationLiters, fiberGrams, coachNotes, mealsDescription, categories }
      });
      const assistantMessage: NutritionAssistantMessage = { id: `nutrition-assistant-${Date.now()}`, role: 'ASSISTANT', createdAt: new Date().toISOString(), content: result.assistantMessage };
      onUpdateMessages([...messages, coachMessage, assistantMessage]);
      onApplyPlan({ ...result, categories: result.categories.slice(0, 12).map((meal, index) => ({ ...meal, id: categories[index]?.id || `meal-ai-${Date.now()}-${index}` })) });
    } catch (error) {
      onUpdateMessages([...messages, coachMessage, { id: `nutrition-error-${Date.now()}`, role: 'ASSISTANT', createdAt: new Date().toISOString(), content: error instanceof Error ? error.message : 'שירות ה־AI אינו זמין כרגע.' }]);
    } finally {
      setIsGenerating(false);
    }
  };

  const loadLibraryPlan = (plan: NutritionPlan) => {
    onApplyPlan({
      assistantMessage: `נטענה תוכנית תזונה קיימת של ${plan.coachName}. אפשר להמשיך להתאים אותה בשיחה.`,
      goal: plan.goal || '',
      dailyCalories: plan.dailyCalories,
      proteinGrams: plan.proteinGrams,
      carbsGrams: plan.carbsGrams,
      fatGrams: plan.fatGrams,
      hydrationLiters: plan.hydrationLiters || 0,
      fiberGrams: plan.fiberGrams || 0,
      coachNotes: plan.coachNotes || '',
      mealsDescription: plan.mealsDescription,
      categories: (plan.categories || []).map((meal, index) => ({ ...meal, id: `nutrition-library-${Date.now()}-${index}` }))
    });
    onUpdateMessages([...messages, {
      id: `nutrition-library-message-${Date.now()}`,
      role: 'ASSISTANT',
      content: `טענתי תוכנית מהמאגר עם ${plan.dailyCalories} קלוריות ו־${plan.categories?.length || 0} ארוחות. אפשר לבקש ממני לשנות כל ארוחה או יעד.`,
      createdAt: new Date().toISOString()
    }]);
    setDrawerOpen(false);
  };

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-amber-300/30 bg-zinc-950 text-white" dir="rtl">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-amber-400 text-zinc-950"><Bot size={23} /></span><div><div className="flex items-center gap-2"><h4 className="text-sm font-black">עוזר בנייה חכם AI</h4><span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[9px] font-black text-emerald-300">OpenAI</span></div><p className="mt-1 text-[11px] text-zinc-400">תכנון תזונה בשיחה עבור {trainee.name}</p></div></div>
          <button type="button" onClick={() => setChatOpen(true)} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 text-sm font-black text-zinc-950"><MessageSquareText size={18} /> פתח עוזר בנייה חכם</button>
        </div>
      </section>
      <AiBuilderChatScreen
        open={chatOpen}
        title="עוזר בניית תוכנית תזונה"
        subtitle={`${trainee.name} · גיל ${trainee.age} · מטרה ${profile?.primaryGoal || goal || 'לא הוגדרה'}`}
        messages={messages.map(message => ({ id: message.id, role: message.role, content: message.content, author: activeUser.name }))}
        input={input}
        onInputChange={setInput}
        onSubmit={() => void handleSend()}
        onClose={() => setChatOpen(false)}
        onConfirm={() => setChatOpen(false)}
        confirmDisabled={categories.length === 0}
        isGenerating={isGenerating}
        suggestions={['בנה תוכנית לירידה במשקל עם 4 ארוחות', 'החלף את ארוחת הערב ללא חלב', 'הגדל חלבון ושמור על היעד הקלורי']}
        onSuggestion={suggestion => void handleSend(suggestion)}
        drawerOpen={drawerOpen}
        onDrawerToggle={() => setDrawerOpen(value => !value)}
        drawerTitle="מאגר תוכניות תזונה"
        drawerDescription="טען תוכנית קיימת כבסיס, ואז התאם אותה למתאמן בשיחה."
        statusText={categories.length ? `${dailyCalories} קלוריות · ${categories.length} ארוחות` : 'ממתין לתוכנית'}
        emptyTitle="איך תרצה לבנות את תוכנית התזונה?"
        emptyDescription="כתוב מטרה, מספר ארוחות, העדפות, אלרגיות ומועדי אימון. העוזר יעדכן את הקלוריות, המאקרו והארוחות לאורך השיחה."
        drawerContent={<div className="space-y-4">
          <section className="grid grid-cols-2 gap-2 text-center">{[['קלוריות', dailyCalories], ['חלבון', `${proteinGrams}g`], ['פחמימה', `${carbsGrams}g`], ['שומן', `${fatGrams}g`]].map(([label, value]) => <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-2"><small className="block text-[9px] text-zinc-400">{label}</small><b className="text-xs text-white">{value}</b></div>)}</section>
          <section><h4 className="mb-2 flex items-center gap-2 text-xs font-black"><Apple size={15} className="text-amber-300" /> תוכניות זמינות</h4><div className="space-y-2">{libraryPlans.map(plan => <button key={plan.id} type="button" onClick={() => loadLibraryPlan(plan)} className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-right hover:border-amber-400/60"><strong className="block text-xs text-white">{plan.goal || `תוכנית של ${plan.coachName}`}</strong><span className="mt-1 block text-[10px] text-zinc-400">{plan.dailyCalories} קלוריות · {plan.categories?.length || 0} ארוחות</span></button>)}{libraryPlans.length === 0 && <p className="rounded-xl border border-dashed border-white/10 p-3 text-center text-[11px] text-zinc-500">אין עדיין תוכניות תזונה במאגר.</p>}</div></section>
          <section className="rounded-xl border border-white/10 bg-white/5 p-3"><h4 className="text-xs font-black text-white">הקשר למתאמן</h4><p className="mt-2 text-[11px] leading-5 text-zinc-300">מטרה: {profile?.primaryGoal || goal || 'לא הוגדרה'}</p><p className="text-[11px] leading-5 text-amber-200">מגבלות: {profile?.limitations || 'לא תועדו'}</p></section>
        </div>}
      />
    </>
  );
};
