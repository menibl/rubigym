import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Dumbbell,
  Loader2,
  MessageSquareText,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
  UserRoundCheck,
  Wrench
} from 'lucide-react';
import {
  CoachPdfDocument,
  Exercise,
  GymEquipment,
  MuscleGroup,
  TraineeMemoryEntry,
  TraineeProfessionalProfile,
  User,
  WorkoutAssistantDraft,
  WorkoutAssistantMessage
} from '../types';
import { getPdfDocumentContent } from '../data/pdfLibraryStorage';

interface WorkoutAssistantPanelProps {
  activeUser: User;
  trainee: User;
  profile?: TraineeProfessionalProfile;
  memoryEntries: TraineeMemoryEntry[];
  equipment: GymEquipment[];
  pdfDocuments: CoachPdfDocument[];
  messages: WorkoutAssistantMessage[];
  draft?: WorkoutAssistantDraft;
  canPublish: boolean;
  onUpdateMessages: (messages: WorkoutAssistantMessage[]) => void;
  onUpdateDraft: (draft: WorkoutAssistantDraft) => void;
  onPublish: (draft: WorkoutAssistantDraft) => void;
}

const muscleGroupLabels: Record<MuscleGroup, string> = {
  [MuscleGroup.UPPER]: 'פלג גוף עליון',
  [MuscleGroup.LEGS]: 'רגליים',
  [MuscleGroup.BACK]: 'גב',
  [MuscleGroup.SHOULDERS]: 'כתפיים',
  [MuscleGroup.CORE]: 'ליבה',
  [MuscleGroup.FUNCTIONAL]: 'פונקציונלי'
};

const fallbackExercises: Array<{ name: string; group: MuscleGroup; category: string }> = [
  { name: 'סקוואט לכיסא', group: MuscleGroup.LEGS, category: 'כוח בסיסי' },
  { name: 'חתירה בעמידה עם גומייה', group: MuscleGroup.BACK, category: 'כוח בסיסי' },
  { name: 'לחיצת חזה בשיפוע', group: MuscleGroup.UPPER, category: 'כוח בסיסי' },
  { name: 'לחיצת כתפיים בישיבה', group: MuscleGroup.SHOULDERS, category: 'כוח בסיסי' },
  { name: 'Dead Bug', group: MuscleGroup.CORE, category: 'ליבה ויציבות' },
  { name: 'הליכה בקצב מתון', group: MuscleGroup.FUNCTIONAL, category: 'סבולת' }
];

const buildLocalDraft = (
  prompt: string,
  trainee: User,
  coach: User,
  profile: TraineeProfessionalProfile | undefined,
  memoryEntries: TraineeMemoryEntry[],
  equipment: GymEquipment[],
  sourceText: string,
  sourceDocumentIds: string[]
): WorkoutAssistantDraft => {
  const normalizedPrompt = prompt.toLowerCase();
  const beginner = profile?.experienceLevel === 'BEGINNER' || /מתחיל|קל|חזרה/.test(normalizedPrompt);
  const strength = /כוח|מסה|היפרטרופיה|כבד/.test(normalizedPrompt);
  const timed = /זמן|מחזור|סבב|אירובי|סבולת/.test(normalizedPrompt);
  const confirmedMemory = memoryEntries.filter(entry => entry.confirmed);
  const rememberedLimitations = confirmedMemory
    .filter(entry => entry.category === 'LIMITATION')
    .map(entry => entry.content)
    .join('; ');
  const rememberedPreferences = confirmedMemory
    .filter(entry => entry.category === 'PREFERENCE' || entry.category === 'GOAL')
    .map(entry => entry.content)
    .join('; ');
  const limitations = `${profile?.limitations || ''} ${profile?.painAreas || ''} ${profile?.prohibitedExercises || ''} ${rememberedLimitations}`.trim();
  const hasLowerBodyCaution = /ברך|ברכיים|קרסול|ירך|גב תחתון/.test(limitations);
  const availableEquipment = equipment.filter(item =>
    item.status !== 'OUT_OF_SERVICE' && item.quantity > 0
  );

  const sourceLower = sourceText.toLowerCase();
  const equipmentByRelevance = [...availableEquipment].sort((a, b) => {
    const aMentioned = [a.name, ...a.aliases].some(name => sourceLower.includes(name.toLowerCase())) ? 1 : 0;
    const bMentioned = [b.name, ...b.aliases].some(name => sourceLower.includes(name.toLowerCase())) ? 1 : 0;
    return bMentioned - aMentioned;
  });

  const equipmentExercises = equipmentByRelevance.slice(0, 4).map(item => ({
    name: item.name,
    group: item.muscleGroups[0] || MuscleGroup.FUNCTIONAL,
    category: item.category || 'תרגיל מכשיר'
  }));
  const candidates = [...equipmentExercises, ...fallbackExercises]
    .filter((item, index, all) => all.findIndex(candidate => candidate.name === item.name) === index)
    .filter(item => !hasLowerBodyCaution || item.group !== MuscleGroup.LEGS || /רגל|ברך/.test(normalizedPrompt));

  const exerciseCount = /קצר|30/.test(normalizedPrompt) ? 4 : /ארוך|60/.test(normalizedPrompt) ? 7 : 6;
  const sets = beginner ? 2 : strength ? 4 : 3;
  const exercises: Exercise[] = candidates.slice(0, exerciseCount).map((item, index) => ({
    id: `assistant-ex-${Date.now()}-${index}`,
    name: item.name,
    category: item.category,
    muscleGroup: item.group,
    sets,
    reps: timed ? '40 שניות' : strength ? '6-10' : beginner ? '10-12' : '10-15',
    weight: beginner ? 'קל, לפי RPE 5-6' : strength ? 'לפי RPE 7-8' : 'לפי RPE 6-7',
    workDuration: timed ? '40 שניות' : '',
    restDuration: timed ? '20 שניות' : strength ? '90 שניות' : '60 שניות',
    notes: `${index === 0 ? 'חימום ספציפי לפני הסט הראשון. ' : ''}לעצור במקרה של כאב ולבצע התאמה מקצועית.`
  }));

  return {
    id: `assistant-draft-${Date.now()}`,
    traineeId: trainee.id,
    coachId: coach.id,
    coachName: coach.name,
    objective: prompt.trim(),
    coachNotes: `${limitations
      ? `המערכת זיהתה מגבלות/כאבים בפרופיל ובזיכרון: ${limitations}. נדרש אישור והתאמה של המאמן.`
      : 'טיוטה אוטומטית. יש לבדוק עומסים, טכניקה והתאמה אישית לפני פרסום.'}${rememberedPreferences ? ` העדפות ומטרות שנשמרו: ${rememberedPreferences}.` : ''}`,
    exercises,
    sourceDocumentIds,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'DRAFT'
  };
};

export const WorkoutAssistantPanel: React.FC<WorkoutAssistantPanelProps> = ({
  activeUser,
  trainee,
  profile,
  memoryEntries,
  equipment,
  pdfDocuments,
  messages,
  draft,
  canPublish,
  onUpdateMessages,
  onUpdateDraft,
  onPublish
}) => {
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  const traineeMessages = useMemo(
    () => messages.filter(message => message.traineeId === trainee.id),
    [messages, trainee.id]
  );
  const readySources = useMemo(() => pdfDocuments.filter(document =>
    document.status === 'READY'
    && (document.visibility === 'TEAM' || document.uploadedById === activeUser.id)
  ), [activeUser.id, pdfDocuments]);
  const availableEquipment = equipment.filter(item => item.status !== 'OUT_OF_SERVICE' && item.quantity > 0);
  const confirmedMemory = memoryEntries.filter(entry => entry.confirmed);

  useEffect(() => {
    setSelectedSourceIds(readySources.slice(0, 3).map(source => source.id));
  }, [trainee.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [traineeMessages.length, isGenerating]);

  const handleSend = async (event?: React.FormEvent, suggestedPrompt?: string) => {
    event?.preventDefault();
    const prompt = (suggestedPrompt ?? input).trim();
    if (!prompt || isGenerating) return;

    const coachMessage: WorkoutAssistantMessage = {
      id: `assistant-message-${Date.now()}-coach`,
      traineeId: trainee.id,
      coachId: activeUser.id,
      coachName: activeUser.name,
      role: 'COACH',
      content: prompt,
      createdAt: new Date().toISOString(),
      sourceDocumentIds: selectedSourceIds
    };
    onUpdateMessages([...messages, coachMessage]);
    setInput('');
    setIsGenerating(true);

    try {
      const sourceContents = await Promise.all(selectedSourceIds.map(id => getPdfDocumentContent(id).catch(() => undefined)));
      const readableSourceIds = selectedSourceIds.filter((_, index) => Boolean(sourceContents[index]));
      const sourceText = sourceContents
        .filter(Boolean)
        .flatMap(content => content!.pages)
        .map(page => page.text)
        .join(' ')
        .slice(0, 20_000);
      const nextDraft = buildLocalDraft(prompt, trainee, activeUser, profile, memoryEntries, availableEquipment, sourceText, readableSourceIds);
      onUpdateDraft(nextDraft);

      const sourceNames = readySources.filter(source => readableSourceIds.includes(source.id)).map(source => source.title);
      const limitationNote = profile?.limitations || profile?.painAreas || profile?.prohibitedExercises;
      const assistantMessage: WorkoutAssistantMessage = {
        id: `assistant-message-${Date.now()}-assistant`,
        traineeId: trainee.id,
        coachId: activeUser.id,
        coachName: activeUser.name,
        role: 'ASSISTANT',
        createdAt: new Date().toISOString(),
        sourceDocumentIds: readableSourceIds,
        content: `הכנתי טיוטה של ${nextDraft.exercises.length} תרגילים עבור ${trainee.name}. ${sourceNames.length ? `השתמשתי גם במקורות: ${sourceNames.join(', ')}.` : 'לא נבחר מקור PDF, לכן הטיוטה מבוססת על פרופיל המתאמן והציוד הזמין.'}${limitationNote ? ' זיהיתי מגבלות בפרופיל וסימנתי למאמן לבצע התאמה מקצועית.' : ''} הטיוטה עדיין לא פורסמה למתאמן.`
      };
      onUpdateMessages([...messages, coachMessage, assistantMessage]);
    } catch {
      onUpdateMessages([...messages, coachMessage, {
        id: `assistant-message-${Date.now()}-error`,
        traineeId: trainee.id,
        coachId: activeUser.id,
        coachName: activeUser.name,
        role: 'ASSISTANT',
        createdAt: new Date().toISOString(),
        content: 'לא הצלחתי לקרוא את אחד המקורות. אפשר לבטל את בחירתו ולנסות שוב.'
      }]);
    } finally {
      setIsGenerating(false);
    }
  };

  const updateExercise = (exerciseId: string, changes: Partial<Exercise>) => {
    if (!draft) return;
    onUpdateDraft({
      ...draft,
      exercises: draft.exercises.map(exercise => exercise.id === exerciseId ? { ...exercise, ...changes } : exercise),
      updatedAt: new Date().toISOString(),
      status: 'DRAFT'
    });
  };

  const removeExercise = (exerciseId: string) => {
    if (!draft) return;
    onUpdateDraft({
      ...draft,
      exercises: draft.exercises.filter(exercise => exercise.id !== exerciseId),
      updatedAt: new Date().toISOString(),
      status: 'DRAFT'
    });
  };

  const clearConversation = () => {
    if (!window.confirm(`למחוק את זיכרון השיחה עבור ${trainee.name}?`)) return;
    onUpdateMessages(messages.filter(message => message.traineeId !== trainee.id));
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-violet-200 bg-white shadow-sm" dir="rtl">
      <div className="bg-gradient-to-l from-violet-950 via-slate-900 to-slate-900 p-4 text-white">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-violet-500/20 p-2 text-violet-300"><Bot size={24} /></div>
            <div>
              <div className="flex items-center gap-2"><h3 className="font-black">עוזר בניית תוכנית</h3><span className="rounded-full bg-amber-300 px-2 py-0.5 text-[10px] font-black text-slate-900">DEMO מקומי</span></div>
              <p className="mt-0.5 text-xs text-slate-300">זיכרון נפרד עבור {trainee.name} · שום מידע לא נשלח לשירות חיצוני</p>
            </div>
          </div>
          <button onClick={clearConversation} className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-white/10"><RotateCcw size={14} /> איפוס שיחה</button>
        </div>
      </div>

      <button onClick={() => setShowContext(value => !value)} className="flex w-full items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3 text-right">
        <span className="flex items-center gap-2 text-sm font-black text-slate-800"><Sparkles size={16} className="text-violet-600" /> ההקשר שהעוזר יקבל</span>
        <span className="flex items-center gap-2 text-xs text-slate-500">{availableEquipment.length} מכשירים · {readySources.length} מקורות · {confirmedMemory.length} פריטי זיכרון {showContext ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
      </button>

      {showContext && (
        <div className="grid gap-3 border-b border-slate-200 bg-slate-50 p-4 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-black text-slate-800"><UserRoundCheck size={15} className="text-violet-600" /> פרופיל וזיכרון</h4>
            <p className="text-xs leading-5 text-slate-600">גיל {trainee.age} · {profile?.experienceLevel === 'BEGINNER' ? 'מתחיל' : profile?.experienceLevel === 'ADVANCED' ? 'מתקדם' : 'בינוני'}</p>
            <p className="text-xs leading-5 text-slate-600">מטרה: {profile?.primaryGoal || 'טרם הוגדרה'}</p>
            <p className="text-xs leading-5 text-amber-700">מגבלות: {profile?.limitations || profile?.painAreas || 'לא תועדו'}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-black text-slate-800"><Wrench size={15} className="text-violet-600" /> ציוד זמין</h4>
            <p className="line-clamp-3 text-xs leading-5 text-slate-600">{availableEquipment.length ? availableEquipment.slice(0, 10).map(item => item.name).join(', ') : 'לא הוזן ציוד. העוזר ישתמש בתרגילי משקל גוף.'}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-black text-slate-800"><BookOpen size={15} className="text-violet-600" /> מקורות PDF</h4>
            <div className="max-h-24 space-y-1 overflow-y-auto">
              {readySources.length ? readySources.map(source => (
                <label key={source.id} className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
                  <input type="checkbox" checked={selectedSourceIds.includes(source.id)} onChange={() => setSelectedSourceIds(ids => ids.includes(source.id) ? ids.filter(id => id !== source.id) : [...ids, source.id])} />
                  <span className="truncate">{source.title}</span>
                </label>
              )) : <p className="text-xs text-slate-500">אין עדיין מקור מוכן לצ׳אט.</p>}
            </div>
          </div>
        </div>
      )}

      <div className="grid min-h-[480px] lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="flex min-h-[430px] flex-col border-b border-slate-200 lg:border-b-0 lg:border-l">
          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4 lg:max-h-[620px]">
            {traineeMessages.length === 0 && (
              <div className="rounded-xl border border-dashed border-violet-200 bg-white p-5 text-center">
                <MessageSquareText className="mx-auto mb-2 text-violet-500" size={28} />
                <p className="text-sm font-black text-slate-800">איך תרצה לבנות את האימון?</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">כתוב מטרה, משך, רמת קושי ודגשים. העוזר ייצור טיוטה לעריכת המאמן.</p>
              </div>
            )}
            {traineeMessages.map(message => (
              <div key={message.id} className={`flex ${message.role === 'COACH' ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[88%] rounded-2xl px-3 py-2.5 text-xs leading-6 ${message.role === 'COACH' ? 'bg-slate-900 text-white' : 'border border-violet-100 bg-white text-slate-700 shadow-sm'}`}>
                  <strong className={`mb-1 block text-[10px] ${message.role === 'COACH' ? 'text-slate-300' : 'text-violet-600'}`}>{message.role === 'COACH' ? message.coachName : 'עוזר התוכנית'}</strong>
                  {message.content}
                </div>
              </div>
            ))}
            {isGenerating && <div className="flex justify-end"><div className="flex items-center gap-2 rounded-2xl border border-violet-100 bg-white px-3 py-2 text-xs text-violet-700"><Loader2 className="animate-spin" size={15} /> קורא הקשר ומכין טיוטה...</div></div>}
            <div ref={endRef} />
          </div>
          <div className="border-t border-slate-200 bg-white p-3">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {['בנה אימון כוח של 45 דקות למתחיל', 'הכן אימון קצר עם הציוד הזמין', 'צור אימון סבולת במחזורים'].map(suggestion => (
                <button key={suggestion} onClick={() => handleSend(undefined, suggestion)} className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-700 hover:bg-violet-100">{suggestion}</button>
              ))}
            </div>
            <form onSubmit={handleSend} className="flex gap-2">
              <textarea value={input} onChange={event => setInput(event.target.value)} rows={2} className="min-w-0 flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2 text-xs" placeholder="לדוגמה: תבנה אימון כוח של 45 דקות, בלי עומס גבוה על הברכיים..." />
              <button disabled={!input.trim() || isGenerating} className="self-stretch rounded-xl bg-violet-600 px-3 text-white disabled:opacity-40"><Send size={18} /></button>
            </form>
          </div>
        </div>

        <div className="bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div><h4 className="flex items-center gap-2 text-sm font-black text-slate-900"><Dumbbell size={17} className="text-violet-600" /> טיוטת המאמן</h4><p className="mt-0.5 text-[11px] text-slate-500">ניתן לערוך כל שדה לפני פרסום</p></div>
            {draft && <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${draft.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>{draft.status === 'PUBLISHED' ? 'פורסם' : 'טיוטה'}</span>}
          </div>
          {!draft ? (
            <div className="flex min-h-80 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-slate-500">
              <Sparkles size={30} className="mb-3 text-violet-400" /><p className="text-sm font-bold">הטיוטה תופיע כאן לאחר השיחה</p>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700">מטרת התוכנית<textarea value={draft.objective} onChange={event => onUpdateDraft({ ...draft, objective: event.target.value, updatedAt: new Date().toISOString(), status: 'DRAFT' })} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label>
              <div className="max-h-[390px] space-y-2 overflow-y-auto pl-1">
                {draft.exercises.map((exercise, index) => (
                  <article key={exercise.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-2 flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-100 text-[10px] font-black text-violet-700">{index + 1}</span><input value={exercise.name} onChange={event => updateExercise(exercise.id, { name: event.target.value })} className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-bold" /><button onClick={() => removeExercise(exercise.id)} className="text-red-500"><Trash2 size={14} /></button></div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <label className="text-[9px] font-bold text-slate-500">סטים<input type="number" min={1} value={exercise.sets} onChange={event => updateExercise(exercise.id, { sets: Number(event.target.value) })} className="mt-0.5 w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800" /></label>
                      <label className="text-[9px] font-bold text-slate-500">חזרות / זמן<input value={exercise.reps} onChange={event => updateExercise(exercise.id, { reps: event.target.value })} className="mt-0.5 w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800" /></label>
                      <label className="text-[9px] font-bold text-slate-500">משקל<input value={exercise.weight || ''} onChange={event => updateExercise(exercise.id, { weight: event.target.value })} className="mt-0.5 w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800" /></label>
                      <label className="text-[9px] font-bold text-slate-500">מנוחה<input value={exercise.restDuration || ''} onChange={event => updateExercise(exercise.id, { restDuration: event.target.value })} className="mt-0.5 w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800" /></label>
                    </div>
                    <p className="mt-2 text-[10px] text-slate-500">{muscleGroupLabels[exercise.muscleGroup]} · {exercise.notes}</p>
                  </article>
                ))}
              </div>
              <label className="block text-xs font-bold text-slate-700">הערת מאמן<textarea value={draft.coachNotes} onChange={event => onUpdateDraft({ ...draft, coachNotes: event.target.value, updatedAt: new Date().toISOString(), status: 'DRAFT' })} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label>
              {!canPublish && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">לא ניתן לפרסם עד שקיימת זכאות או רכישה של תוכנית אימון.</p>}
              <button disabled={!canPublish || !draft.exercises.length || draft.status === 'PUBLISHED'} onClick={() => onPublish(draft)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"><Check size={18} /> אשר ופרסם למתאמן</button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
