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
  Plus,
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
import { generatePersonalWorkoutWithAi } from '../data/workoutAi';

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
  { name: 'סקוואט', group: MuscleGroup.LEGS, category: 'כוח בסיסי' },
  { name: 'מכרעים לאחור', group: MuscleGroup.LEGS, category: 'כוח רגליים' },
  { name: 'הרמת אגן', group: MuscleGroup.LEGS, category: 'ישבן וירך אחורית' },
  { name: 'חתירה בעמידה עם גומייה', group: MuscleGroup.BACK, category: 'כוח בסיסי' },
  { name: 'משיכת פולי עליון', group: MuscleGroup.BACK, category: 'משיכה' },
  { name: 'לחיצת חזה בשיפוע', group: MuscleGroup.UPPER, category: 'כוח בסיסי' },
  { name: 'שכיבות סמיכה', group: MuscleGroup.UPPER, category: 'דחיפה' },
  { name: 'לחיצת כתפיים בישיבה', group: MuscleGroup.SHOULDERS, category: 'כוח בסיסי' },
  { name: 'Dead Bug', group: MuscleGroup.CORE, category: 'ליבה ויציבות' },
  { name: 'פלאנק', group: MuscleGroup.CORE, category: 'בטן וליבה' },
  { name: 'Pallof Press', group: MuscleGroup.CORE, category: 'ליבה נגד סיבוב' },
  { name: 'Farmer Walk', group: MuscleGroup.FUNCTIONAL, category: 'כוח פונקציונלי' },
  { name: 'הליכה בקצב מתון', group: MuscleGroup.FUNCTIONAL, category: 'סבולת' }
];

const hebrewDayNumbers: Record<string, number> = {
  ראשון: 1, הראשונה: 1, אחד: 1, אחת: 1,
  שני: 2, השני: 2, שנייה: 2, השנייה: 2, שניים: 2, שתיים: 2,
  שלישי: 3, השלישי: 3, שלושה: 3, שלוש: 3,
  רביעי: 4, הרביעי: 4, ארבעה: 4, ארבע: 4,
  חמישי: 5, החמישי: 5, חמישה: 5, חמש: 5,
  שישי: 6, השישי: 6, שישה: 6, שש: 6,
  שביעי: 7, השביעי: 7, שבעה: 7, שבע: 7
};

const parseRequestedDays = (prompt: string) => {
  const numeric = prompt.match(/([1-7])\s*(?:ימים|יום|פעמים)/)?.[1];
  if (numeric) return Number(numeric);
  const word = Object.entries(hebrewDayNumbers).find(([label]) => new RegExp(`${label}\\s*(?:ימים|פעמים)`).test(prompt));
  return word?.[1];
};

const parseReferencedDay = (prompt: string) => {
  const numeric = prompt.match(/(?:ביום|יום)\s*(?:ה)?([1-7])/i)?.[1];
  if (numeric) return Number(numeric);
  const match = Object.entries(hebrewDayNumbers).find(([label]) => prompt.includes(`יום ${label}`) || prompt.includes(`ביום ${label}`));
  return match?.[1];
};

const inferMuscleGroup = (name: string): MuscleGroup => {
  const normalized = name.toLowerCase();
  if (/סקוואט|מכרע|רגל|אגן|ישבן/.test(normalized)) return MuscleGroup.LEGS;
  if (/בטן|ליבה|פלאנק|dead bug|pallof/.test(normalized)) return MuscleGroup.CORE;
  if (/חתירה|גב|פולי|משיכ/.test(normalized)) return MuscleGroup.BACK;
  if (/כתפ/.test(normalized)) return MuscleGroup.SHOULDERS;
  if (/חזה|שכיבות|דחיפ/.test(normalized)) return MuscleGroup.UPPER;
  return MuscleGroup.FUNCTIONAL;
};

const exerciseMatches = (exercise: Exercise, query: string) => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return false;
  if (exercise.name.toLowerCase().includes(normalized) || normalized.includes(exercise.name.toLowerCase())) return true;
  if (/בטן|ליבה/.test(normalized) && exercise.muscleGroup === MuscleGroup.CORE) return true;
  if (/רגל|סקוואט/.test(normalized) && exercise.muscleGroup === MuscleGroup.LEGS) return true;
  if (/גב|חתירה|משיכה/.test(normalized) && exercise.muscleGroup === MuscleGroup.BACK) return true;
  if (/חזה|דחיפה/.test(normalized) && exercise.muscleGroup === MuscleGroup.UPPER) return true;
  return false;
};

const dayLabelsFor = (days: number, strength: boolean) => Array.from({ length: days }, (_, index) => {
  if (!strength) return `יום אימון ${index + 1}`;
  const strengthLabels = ['דחיפה ופלג עליון', 'רגליים וליבה', 'משיכה וגוף מלא', 'כוח משולב'];
  return `יום ${index + 1} · ${strengthLabels[index % strengthLabels.length]}`;
});

const applyPromptToDraft = (prompt: string, current: WorkoutAssistantDraft): { draft: WorkoutAssistantDraft; response: string } | undefined => {
  const normalized = prompt.trim().toLowerCase();
  const referencedDay = parseReferencedDay(normalized);
  const requestedDays = parseRequestedDays(normalized);
  const now = new Date().toISOString();

  if (requestedDays && !/(?:בנה|צור|תכין).*(?:אימון|תוכנית)/.test(normalized) && /(?:שנה|עדכן|תעשה|תהיה|יהיו|ימים|פעמים)/.test(normalized)) {
    const days = Math.min(7, Math.max(1, requestedDays));
    return {
      draft: {
        ...current,
        trainingDaysPerWeek: days,
        dayLabels: dayLabelsFor(days, /כוח/.test(`${current.objective} ${normalized}`)),
        exercises: current.exercises.map(exercise => ({ ...exercise, dayNumber: Math.min(exercise.dayNumber || 1, days) })),
        updatedAt: now,
        status: 'DRAFT'
      },
      response: `מספר ימי האימון עודכן ל־${days}. אפשר לבקש ממני להוסיף או להחליף תרגילים בכל יום בנפרד.`
    };
  }

  const replacement = normalized.match(/(?:תחליף|החלף)(?:\s+את)?\s+(.+?)\s+ב(?:-|־)?\s*(.+?)(?:\s+ביום|$)/);
  if (replacement) {
    const [, fromQuery, toNameRaw] = replacement;
    const day = referencedDay || 1;
    const candidates = current.exercises.filter(exercise => (exercise.dayNumber || 1) === day);
    const target = candidates.find(exercise => exerciseMatches(exercise, fromQuery)) || candidates[0];
    if (!target) return { draft: current, response: `לא מצאתי תרגיל מתאים ביום ${day}. אפשר לציין את שם התרגיל כפי שהוא מופיע בטיוטה.` };
    const toName = toNameRaw.replace(/\s+(?:ביום|יום)\s+.+$/, '').trim();
    return {
      draft: {
        ...current,
        exercises: current.exercises.map(exercise => exercise.id === target.id ? {
          ...exercise,
          name: toName,
          muscleGroup: inferMuscleGroup(toName),
          category: 'תרגיל שהוחלף בצ׳אט'
        } : exercise),
        updatedAt: now,
        status: 'DRAFT'
      },
      response: `ביום ${day} החלפתי את „${target.name}” ב„${toName}”. הטיוטה עודכנה ואפשר להמשיך לערוך.`
    };
  }

  const removal = normalized.match(/(?:מחק|הסר)(?:\s+את)?\s+(.+?)(?:\s+מיום|\s+ביום|$)/);
  if (removal) {
    const day = referencedDay || 1;
    const target = current.exercises.find(exercise => (exercise.dayNumber || 1) === day && exerciseMatches(exercise, removal[1]));
    if (!target) return { draft: current, response: `לא מצאתי את התרגיל שביקשת להסיר ביום ${day}.` };
    return {
      draft: { ...current, exercises: current.exercises.filter(exercise => exercise.id !== target.id), updatedAt: now, status: 'DRAFT' },
      response: `הסרתי את „${target.name}” מיום ${day}.`
    };
  }

  const addition = normalized.match(/(?:הוסף|תוסיף)(?:\s+את)?\s+(.+?)(?:\s+ליום|\s+ביום|$)/);
  if (addition) {
    const day = Math.min(current.trainingDaysPerWeek || 1, referencedDay || 1);
    const name = addition[1].trim();
    const exercise: Exercise = {
      id: `assistant-chat-${Date.now()}`,
      name,
      category: 'תרגיל שנוסף בצ׳אט',
      muscleGroup: inferMuscleGroup(name),
      sets: 3,
      reps: '10-12',
      weight: 'לפי יכולת',
      restDuration: '60 שניות',
      dayNumber: day,
      notes: 'נוסף לפי בקשת המאמן; יש לאשר עומס וטכניקה.'
    };
    return {
      draft: { ...current, exercises: [...current.exercises, exercise], updatedAt: now, status: 'DRAFT' },
      response: `הוספתי את „${name}” ליום ${day}.`
    };
  }

  const move = normalized.match(/(?:העבר|תעביר)(?:\s+את)?\s+(.+?)\s+ליום/);
  if (move && referencedDay) {
    const target = current.exercises.find(exercise => exerciseMatches(exercise, move[1]));
    if (!target) return { draft: current, response: 'לא מצאתי את התרגיל שביקשת להעביר.' };
    const day = Math.min(current.trainingDaysPerWeek || 1, referencedDay);
    return {
      draft: { ...current, exercises: current.exercises.map(exercise => exercise.id === target.id ? { ...exercise, dayNumber: day } : exercise), updatedAt: now, status: 'DRAFT' },
      response: `העברתי את „${target.name}” ליום ${day}.`
    };
  }

  return undefined;
};

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

  const exercisesPerDay = /קצר|30/.test(normalizedPrompt) ? 4 : /ארוך|60/.test(normalizedPrompt) ? 7 : 5;
  const requestedDays = parseRequestedDays(normalizedPrompt);
  const trainingDaysPerWeek = Math.min(7, Math.max(1, requestedDays || profile?.weeklySessions || 2));
  const sets = beginner ? 2 : strength ? 4 : 3;
  const exercises: Exercise[] = Array.from({ length: trainingDaysPerWeek }).flatMap((_, dayIndex) =>
    Array.from({ length: exercisesPerDay }, (_, exerciseIndex) => {
      const item = candidates[(dayIndex * exercisesPerDay + exerciseIndex) % candidates.length];
      return {
        id: `assistant-ex-${Date.now()}-${dayIndex}-${exerciseIndex}`,
        name: item.name,
        category: item.category,
        muscleGroup: item.group,
        sets,
        reps: timed ? '40 שניות' : strength ? '6-10' : beginner ? '10-12' : '10-15',
        weight: beginner ? 'קל, לפי RPE 5-6' : strength ? 'לפי RPE 7-8' : 'לפי RPE 6-7',
        workDuration: timed ? '40 שניות' : '',
        restDuration: timed ? '20 שניות' : strength ? '90 שניות' : '60 שניות',
        notes: `${exerciseIndex === 0 ? 'חימום ספציפי לפני הסט הראשון. ' : ''}לעצור במקרה של כאב ולבצע התאמה מקצועית.`,
        dayNumber: dayIndex + 1
      };
    })
  );

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
    trainingDaysPerWeek,
    dayLabels: dayLabelsFor(trainingDaysPerWeek, strength),
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
  const [selectedDraftDay, setSelectedDraftDay] = useState(1);
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

  useEffect(() => {
    setSelectedDraftDay(day => Math.min(Math.max(1, day), draft?.trainingDaysPerWeek || 1));
  }, [draft?.trainingDaysPerWeek, trainee.id]);

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
      const sourceDocuments = readableSourceIds.map(id => {
        const source = readySources.find(document => document.id === id)!;
        const content = sourceContents[selectedSourceIds.indexOf(id)];
        return {
          id: source.id,
          title: source.title,
          category: source.category,
          tags: source.tags,
          text: content?.pages.map(page => page.text).join('\n').slice(0, 20_000) || ''
        };
      });
      const { result } = await generatePersonalWorkoutWithAi({
        message: prompt,
        actor: activeUser,
        trainee,
        professionalProfile: profile,
        confirmedMemory,
        equipment: availableEquipment,
        sourceDocuments,
        conversation: [...traineeMessages, coachMessage],
        currentDraft: draft
      });
      const now = new Date().toISOString();
      const trainingDays = Math.min(7, Math.max(1, Math.round(result.trainingDaysPerWeek || 1)));
      const nextDraft: WorkoutAssistantDraft = {
        id: draft?.id || `assistant-draft-${Date.now()}`,
        traineeId: trainee.id,
        coachId: activeUser.id,
        coachName: activeUser.name,
        objective: result.objective,
        coachNotes: result.coachNotes,
        exercises: result.exercises.slice(0, 60).map((exercise, index) => {
          const dayNumber = Math.min(trainingDays, Math.max(1, Math.round(exercise.dayNumber || 1)));
          const existing = draft?.exercises.find(item => item.dayNumber === dayNumber && item.name === exercise.name);
          return {
            ...exercise,
            name: exercise.name.trim() || `תרגיל ${index + 1}`,
            sets: Math.min(20, Math.max(1, Math.round(exercise.sets || 1))),
            dayNumber,
            id: existing?.id || `assistant-ai-ex-${Date.now()}-${index}`,
            mediaUrl: existing?.mediaUrl,
            mediaType: existing?.mediaType,
            mediaStorageId: existing?.mediaStorageId
          };
        }),
        trainingDaysPerWeek: trainingDays,
        dayLabels: Array.from({ length: trainingDays }, (_, index) => result.dayLabels[index]?.trim() || `יום ${index + 1}`),
        sourceDocumentIds: readableSourceIds,
        createdAt: draft?.createdAt || now,
        updatedAt: now,
        status: 'DRAFT'
      };
      onUpdateDraft(nextDraft);
      setSelectedDraftDay(Math.min(nextDraft.trainingDaysPerWeek || 1, Math.max(1, result.focusDay)));

      const assistantMessage: WorkoutAssistantMessage = {
        id: `assistant-message-${Date.now()}-assistant`,
        traineeId: trainee.id,
        coachId: activeUser.id,
        coachName: activeUser.name,
        role: 'ASSISTANT',
        createdAt: new Date().toISOString(),
        sourceDocumentIds: readableSourceIds,
        content: result.assistantMessage
      };
      onUpdateMessages([...messages, coachMessage, assistantMessage]);
    } catch (error) {
      onUpdateMessages([...messages, coachMessage, {
        id: `assistant-message-${Date.now()}-error`,
        traineeId: trainee.id,
        coachId: activeUser.id,
        coachName: activeUser.name,
        role: 'ASSISTANT',
        createdAt: new Date().toISOString(),
        content: error instanceof Error ? error.message : 'שירות ה־AI אינו זמין כרגע. נסו שוב מאוחר יותר.'
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

  const addBlankExercise = () => {
    if (!draft) return;
    const exercise: Exercise = {
      id: `assistant-manual-${Date.now()}`,
      name: 'תרגיל חדש',
      category: 'תרגיל מותאם',
      muscleGroup: MuscleGroup.FUNCTIONAL,
      sets: 3,
      reps: '10-12',
      weight: 'לפי יכולת',
      restDuration: '60 שניות',
      dayNumber: selectedDraftDay,
      notes: ''
    };
    onUpdateDraft({ ...draft, exercises: [...draft.exercises, exercise], updatedAt: new Date().toISOString(), status: 'DRAFT' });
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
              <div className="flex items-center gap-2"><h3 className="font-black">עוזר בניית תוכנית</h3><span className="rounded-full bg-emerald-300 px-2 py-0.5 text-[10px] font-black text-slate-900">OpenAI</span></div>
              <p className="mt-0.5 text-xs text-slate-300">הקשר נפרד עבור {trainee.name} · פרופיל, מגבלות, ציוד ומקורות נבחרים</p>
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
              {['בנה תוכנית כוח ל־3 ימים בשבוע', 'ביום השני החלף את הבטן בסקוואט', 'הוסף פלאנק ליום השלישי'].map(suggestion => (
                <button key={suggestion} onClick={() => handleSend(undefined, suggestion)} className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-700 hover:bg-violet-100">{suggestion}</button>
              ))}
            </div>
            <form onSubmit={handleSend} className="flex gap-2">
              <textarea value={input} onChange={event => setInput(event.target.value)} rows={2} className="min-w-0 flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2 text-xs" placeholder="לדוגמה: תבנה תוכנית כוח ל־3 ימים, וביום השני תחליף את הבטן בסקוואט..." />
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
              <div className="flex items-end justify-between gap-3 rounded-xl border border-violet-100 bg-violet-50 p-3">
                <div><span className="block text-[10px] font-bold text-slate-500">מבנה שנוצר מתוך הצ׳אט</span><strong className="text-sm text-slate-900">{draft.trainingDaysPerWeek || 1} ימים בשבוע</strong><small className="mt-0.5 block text-[9px] text-violet-700">לשינוי כתבו בצ׳אט: “שנה ל־4 ימים”</small></div>
                <button onClick={addBlankExercise} className="flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white"><Plus size={14} /> הוסף תרגיל</button>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {Array.from({ length: draft.trainingDaysPerWeek || 1 }, (_, index) => index + 1).map(day => <button key={day} type="button" onClick={() => setSelectedDraftDay(day)} className={`min-w-fit rounded-xl px-3 py-2 text-[10px] font-black ${selectedDraftDay === day ? 'bg-violet-600 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>{draft.dayLabels?.[day - 1] || `יום ${day}`} <span className="opacity-70">({draft.exercises.filter(exercise => (exercise.dayNumber || 1) === day).length})</span></button>)}
              </div>
              <div className="max-h-[390px] space-y-2 overflow-y-auto pl-1">
                {draft.exercises.filter(exercise => (exercise.dayNumber || 1) === selectedDraftDay).map((exercise, index) => (
                  <article key={exercise.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-2 flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-100 text-[10px] font-black text-violet-700">{index + 1}</span><input value={exercise.name} onChange={event => updateExercise(exercise.id, { name: event.target.value })} className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-bold" /><button onClick={() => removeExercise(exercise.id)} className="text-red-500"><Trash2 size={14} /></button></div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <label className="text-[9px] font-bold text-slate-500">סטים<input type="number" min={1} value={exercise.sets} onChange={event => updateExercise(exercise.id, { sets: Number(event.target.value) })} className="mt-0.5 w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800" /></label>
                      <label className="text-[9px] font-bold text-slate-500">חזרות / זמן<input value={exercise.reps} onChange={event => updateExercise(exercise.id, { reps: event.target.value })} className="mt-0.5 w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800" /></label>
                      <label className="text-[9px] font-bold text-slate-500">משקל<input value={exercise.weight || ''} onChange={event => updateExercise(exercise.id, { weight: event.target.value })} className="mt-0.5 w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800" /></label>
                      <label className="text-[9px] font-bold text-slate-500">מנוחה<input value={exercise.restDuration || ''} onChange={event => updateExercise(exercise.id, { restDuration: event.target.value })} className="mt-0.5 w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800" /></label>
                      <label className="text-[9px] font-bold text-slate-500">יום אימון<select value={exercise.dayNumber || 1} onChange={event => updateExercise(exercise.id, { dayNumber: Number(event.target.value) })} className="mt-0.5 w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800">{Array.from({ length: draft.trainingDaysPerWeek || 1 }, (_, index) => index + 1).map(day => <option key={day} value={day}>יום {day}</option>)}</select></label>
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
