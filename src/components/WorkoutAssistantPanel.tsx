import React, { useEffect, useMemo, useState } from 'react';
import {
  Bot,
  Check,
  Dumbbell,
  MessageSquareText,
  Plus,
  Sparkles,
  Trash2,
  UserRoundCheck
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
  WorkoutAssistantMessage,
  WorkoutPlan
} from '../types';
import { getPdfDocumentContent } from '../data/pdfLibraryStorage';
import { generatePersonalWorkoutWithAi } from '../data/workoutAi';
import { AiBuilderChatScreen } from './AiBuilderChatScreen';
import { AiEquipmentSelector } from './AiEquipmentSelector';
import { AiPdfSourcePanel } from './AiPdfSourcePanel';

interface WorkoutAssistantPanelProps {
  activeUser: User;
  trainee: User;
  profile?: TraineeProfessionalProfile;
  memoryEntries: TraineeMemoryEntry[];
  equipment: GymEquipment[];
  pdfDocuments: CoachPdfDocument[];
  messages: WorkoutAssistantMessage[];
  draft?: WorkoutAssistantDraft;
  libraryPlans?: WorkoutPlan[];
  canPublish: boolean;
  onUpdateMessages: (messages: WorkoutAssistantMessage[]) => void;
  onUpdateDraft: (draft: WorkoutAssistantDraft) => void;
  onPublish: (draft: WorkoutAssistantDraft) => void;
  onUpdateEquipment: (equipment: GymEquipment[]) => void;
  onUpdatePdfDocuments: (documents: CoachPdfDocument[]) => void;
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
  { name: 'פשיטת יד ורגל נגדית בשכיבה', group: MuscleGroup.CORE, category: 'ליבה ויציבות' },
  { name: 'פלאנק', group: MuscleGroup.CORE, category: 'בטן וליבה' },
  { name: 'לחיצה נגד סיבוב בכבל', group: MuscleGroup.CORE, category: 'ליבה נגד סיבוב' },
  { name: 'הליכת איכר', group: MuscleGroup.FUNCTIONAL, category: 'כוח פונקציונלי' },
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
  if (/בטן|ליבה|פלאנק|פשיטת יד ורגל|לחיצה נגד סיבוב|dead bug|pallof/.test(normalized)) return MuscleGroup.CORE;
  if (/חתירה|גב|פולי|משיכ/.test(normalized)) return MuscleGroup.BACK;
  if (/כתפ/.test(normalized)) return MuscleGroup.SHOULDERS;
  if (/חזה|שכיבות|דחיפ/.test(normalized)) return MuscleGroup.UPPER;
  return MuscleGroup.FUNCTIONAL;
};

const localEquipmentExerciseName = (item: GymEquipment) => {
  const hebrewAlias = [item.name, ...item.aliases].find(value => value.trim() && !/[A-Za-z]/.test(value));
  if (hebrewAlias) return hebrewAlias;
  const normalized = `${item.name} ${item.aliases.join(' ')}`.toLowerCase();
  const translations: Array<[RegExp, string]> = [
    [/leg press/, 'לחיצת רגליים במכשיר'],
    [/leg extension/, 'פשיטת ברכיים במכשיר'],
    [/leg curl/, 'כפיפת ברכיים במכשיר'],
    [/chest press/, 'לחיצת חזה במכשיר'],
    [/lat pulldown|pulldown/, 'משיכת פולי עליון'],
    [/seated row|\brow\b/, 'חתירה במכשיר'],
    [/shoulder press/, 'לחיצת כתפיים במכשיר'],
    [/pec deck|chest fly|butterfly/, 'פרפר חזה במכשיר'],
    [/treadmill/, 'הליכה על מסילה'],
    [/stationary bike|exercise bike|\bbike\b/, 'רכיבה על אופניים נייחים'],
    [/elliptical/, 'אימון במכשיר אליפטי'],
    [/cable/, 'תרגיל במכשיר כבלים'],
    [/smith/, 'תרגיל במכשיר סמית']
  ];
  return translations.find(([pattern]) => pattern.test(normalized))?.[1]
    || `תרגיל מכשיר — ${muscleGroupLabels[item.muscleGroups[0] || MuscleGroup.FUNCTIONAL]}`;
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

  const equipmentExercises = equipmentByRelevance.slice(0, 8).map(item => ({
    name: localEquipmentExerciseName(item),
    group: item.muscleGroups[0] || MuscleGroup.FUNCTIONAL,
    category: item.category && !/[A-Za-z]/.test(item.category) ? item.category : 'תרגיל במכשיר'
  }));
  const isSafeCandidate = (item: { group: MuscleGroup }) => !hasLowerBodyCaution || item.group !== MuscleGroup.LEGS || /רגל|ברך/.test(normalizedPrompt);
  const safeEquipmentExercises = equipmentExercises
    .filter((item, index, all) => all.findIndex(candidate => candidate.name === item.name) === index)
    .filter(isSafeCandidate);
  const safeFallbackExercises = fallbackExercises.filter(isSafeCandidate);

  const exercisesPerDay = /קצר|30/.test(normalizedPrompt) ? 4 : /ארוך|60/.test(normalizedPrompt) ? 7 : 5;
  const requestedDays = parseRequestedDays(normalizedPrompt);
  const trainingDaysPerWeek = Math.min(7, Math.max(1, requestedDays || profile?.weeklySessions || 2));
  const sets = beginner ? 2 : strength ? 4 : 3;
  const machineExercisesPerDay = safeEquipmentExercises.length > 0
    ? Math.min(exercisesPerDay, Math.ceil(exercisesPerDay * 2 / 3), safeEquipmentExercises.length)
    : 0;
  const exercises: Exercise[] = Array.from({ length: trainingDaysPerWeek }).flatMap((_, dayIndex) =>
    Array.from({ length: exercisesPerDay }, (_, exerciseIndex) => {
      const item = exerciseIndex < machineExercisesPerDay
        ? safeEquipmentExercises[(dayIndex * machineExercisesPerDay + exerciseIndex) % safeEquipmentExercises.length]
        : safeFallbackExercises[(dayIndex * exercisesPerDay + exerciseIndex - machineExercisesPerDay) % safeFallbackExercises.length];
      return {
        id: `assistant-ex-${Date.now()}-${dayIndex}-${exerciseIndex}`,
        name: item.name,
        category: item.category,
        muscleGroup: item.group,
        sets,
        reps: timed ? '40 שניות' : strength ? '6-10' : beginner ? '10-12' : '10-15',
        weight: beginner ? 'קל, לפי דרגת מאמץ נתפסת 5–6' : strength ? 'לפי דרגת מאמץ נתפסת 7–8' : 'לפי דרגת מאמץ נתפסת 6–7',
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
  libraryPlans = [],
  canPublish,
  onUpdateMessages,
  onUpdateDraft,
  onPublish,
  onUpdateEquipment,
  onUpdatePdfDocuments
}) => {
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<'PREVIEW' | 'SOURCES' | 'EQUIPMENT'>('SOURCES');
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<string[]>([]);
  const [selectedDraftDay, setSelectedDraftDay] = useState(1);

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
    setSelectedEquipmentIds(availableEquipment.map(item => item.id));
  }, [trainee.id]);

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
        equipment: availableEquipment.filter(item => selectedEquipmentIds.includes(item.id)),
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
      setDrawerTab('PREVIEW');
      setDrawerOpen(true);
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

  const loadLibraryPlan = (plan: WorkoutPlan) => {
    const now = new Date().toISOString();
    onUpdateDraft({
      id: draft?.id || `assistant-draft-${Date.now()}`,
      traineeId: trainee.id,
      coachId: activeUser.id,
      coachName: activeUser.name,
      objective: `${plan.title || draft?.objective || 'תוכנית אישית מהמאגר'} · עותק · ${new Date().toLocaleDateString('he-IL')}`,
      coachNotes: draft?.coachNotes || `נטענה תוכנית מהמאגר של ${plan.coachName}.`,
      exercises: plan.exercises.map((exercise, index) => ({ ...exercise, id: `assistant-library-${Date.now()}-${index}` })),
      trainingDaysPerWeek: plan.trainingDaysPerWeek || 1,
      dayLabels: plan.dayLabels || ['יום 1'],
      sourceDocumentIds: draft?.sourceDocumentIds || [],
      createdAt: draft?.createdAt || now,
      updatedAt: now,
      status: 'DRAFT'
    });
    onUpdateMessages([...messages, {
      id: `assistant-library-message-${Date.now()}`,
      traineeId: trainee.id,
      coachId: activeUser.id,
      coachName: activeUser.name,
      role: 'ASSISTANT',
      content: `טענתי את התוכנית „${plan.title || 'תוכנית מהמאגר'}” כטיוטה עבור ${trainee.name}. אפשר לבקש ממני להתאים ימים, תרגילים ועומסים.`,
      createdAt: now
    }]);
    setSelectedDraftDay(1);
    setDrawerTab('PREVIEW');
    setDrawerOpen(true);
  };

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-amber-300/30 bg-zinc-950 text-white shadow-sm" dir="rtl">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-amber-400 text-zinc-950"><Bot size={23} /></span><div><div className="flex items-center gap-2"><h3 className="text-sm font-black">עוזר בנייה חכם AI</h3><span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[9px] font-black text-emerald-300">OpenAI</span></div><p className="mt-1 text-[11px] text-zinc-400">שיחה מלאה לבנייה ולעדכון התוכנית של {trainee.name}</p></div></div>
          <button type="button" onClick={() => setChatOpen(true)} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 text-sm font-black text-zinc-950 shadow-lg shadow-amber-400/10"><MessageSquareText size={18} /> פתח עוזר בנייה חכם</button>
        </div>
      </section>

      <AiBuilderChatScreen
        open={chatOpen}
        title="עוזר בניית תוכנית אימון אישית"
        subtitle={`${trainee.name} · פרופיל, מגבלות, ציוד ומקורות נבחרים`}
        messages={traineeMessages.map(message => ({ id: message.id, role: message.role, content: message.content, author: message.coachName }))}
        input={input}
        onInputChange={setInput}
        onSubmit={() => void handleSend()}
        onClose={() => setChatOpen(false)}
        onConfirm={() => { setDrawerTab('PREVIEW'); setDrawerOpen(true); }}
        confirmLabel="צפייה בתוכנית"
        confirmDisabled={!draft?.exercises.length}
        isGenerating={isGenerating}
        suggestions={['בנה תוכנית כוח ל־3 ימים בשבוע', 'ביום השני החלף את הבטן בסקוואט', 'הוסף פלאנק ליום השלישי']}
        onSuggestion={suggestion => void handleSend(undefined, suggestion)}
        drawerOpen={drawerOpen}
        onDrawerToggle={() => setDrawerOpen(value => !value)}
        drawerTitle="מרכז בניית התוכנית"
        drawerDescription="צפה בטיוטה, טען מקור קיים או בחר ציוד לאימון."
        drawerTabs={[{ id: 'PREVIEW', label: 'התוכנית שנוצרה' }, { id: 'SOURCES', label: 'מאגר ו־PDF' }, { id: 'EQUIPMENT', label: 'ציוד ומכשירים' }]}
        activeDrawerTab={drawerTab}
        onDrawerTabChange={tab => setDrawerTab(tab as typeof drawerTab)}
        statusText={draft ? `${draft.trainingDaysPerWeek || 1} ימים · ${draft.exercises.length} תרגילים` : 'ממתין לטיוטה'}
        emptyTitle="איך תרצה לבנות את האימון?"
        emptyDescription="כתוב מטרה, מספר ימים, משך, רמת קושי ומגבלות. העוזר ישאל רק על מידע שחסר ויעדכן את הטיוטה לאורך השיחה."
        onReset={clearConversation}
        drawerContent={drawerTab === 'PREVIEW' ? <div className="space-y-3">
          {!draft ? <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-zinc-500">התוכנית תופיע כאן אוטומטית לאחר שהעוזר יסיים לבנות אותה.</p> : <>
            <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3"><strong className="text-sm text-white">{draft.objective || 'תוכנית אימון אישית'}</strong><p className="mt-1 text-[10px] text-zinc-300">{draft.trainingDaysPerWeek || 1} ימים · {draft.exercises.length} תרגילים</p></div>
            {Array.from({ length: draft.trainingDaysPerWeek || 1 }, (_, index) => index + 1).map(day => <section key={day} className="rounded-xl border border-white/10 bg-white/5 p-3"><h4 className="mb-2 text-xs font-black text-amber-200">{draft.dayLabels?.[day - 1] || `יום ${day}`}</h4><div className="space-y-2">{draft.exercises.filter(exercise => (exercise.dayNumber || 1) === day).map((exercise, index) => <article key={exercise.id} className="rounded-lg bg-zinc-950 p-2.5"><div className="flex items-start gap-2"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-amber-400 text-[9px] font-black text-zinc-950">{index + 1}</span><div><strong className="block text-xs text-white">{exercise.name}</strong><span className="text-[9px] text-zinc-400">{exercise.sets} סטים · {exercise.reps} · {exercise.weight || 'משקל לפי יכולת'}</span></div></div></article>)}</div></section>)}
            {!canPublish && <p className="rounded-lg bg-amber-500/10 p-3 text-[10px] text-amber-200">התוכנית תישמר כטיוטה עד להסדרת הזכאות של המתאמן.</p>}
            <button type="button" disabled={!canPublish || !draft.exercises.length} onClick={() => { onPublish(draft); setChatOpen(false); }} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 text-xs font-black text-white disabled:opacity-40"><Check size={16} /> {draft.status === 'PUBLISHED' ? 'פרסם מחדש' : 'פרסם תוכנית'}</button>
          </>}
        </div> : drawerTab === 'SOURCES' ? <div className="space-y-4">
          <section className="rounded-xl border border-white/10 bg-white/5 p-3"><h4 className="flex items-center gap-2 text-xs font-black"><UserRoundCheck size={15} className="text-amber-300" /> נתוני המתאמן</h4><p className="mt-2 text-[11px] leading-5 text-zinc-300">גיל {trainee.age} · מטרה: {profile?.primaryGoal || 'טרם הוגדרה'}</p><p className="text-[11px] leading-5 text-amber-200">מגבלות: {profile?.limitations || profile?.painAreas || 'לא תועדו'}</p></section>
          <section><h4 className="mb-2 flex items-center gap-2 text-xs font-black"><Dumbbell size={15} className="text-amber-300" /> תוכניות מהמאגר</h4><div className="space-y-2">{libraryPlans.map(plan => <button key={plan.id} type="button" onClick={() => loadLibraryPlan(plan)} className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-right hover:border-amber-400/60"><strong className="block text-xs text-white">{plan.title || `תוכנית של ${plan.coachName}`}</strong><span className="mt-1 block text-[10px] text-zinc-400">{plan.trainingDaysPerWeek || 1} ימים · {plan.exercises.length} תרגילים</span></button>)}{libraryPlans.length === 0 && <p className="rounded-xl border border-dashed border-white/10 p-3 text-center text-[11px] text-zinc-500">אין עדיין תוכניות במאגר.</p>}</div></section>
          <AiPdfSourcePanel activeUser={activeUser} category="תוכניות אימון" documents={pdfDocuments} selectedIds={selectedSourceIds} onSelectedIdsChange={setSelectedSourceIds} onUpdateDocuments={onUpdatePdfDocuments} />
        </div> : <AiEquipmentSelector activeUser={activeUser} equipment={equipment} selectedIds={selectedEquipmentIds} onSelectedIdsChange={setSelectedEquipmentIds} onUpdateEquipment={onUpdateEquipment} />}
      />

      <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" dir="rtl">
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
              <label className="block text-xs font-bold text-slate-700">שם התוכנית<input value={draft.objective} onChange={event => onUpdateDraft({ ...draft, objective: event.target.value, updatedAt: new Date().toISOString(), status: 'DRAFT' })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label>
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
              <button disabled={!canPublish || !draft.exercises.length} onClick={() => onPublish(draft)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"><Check size={18} /> {draft.status === 'PUBLISHED' ? 'פרסם מחדש' : 'פרסם תוכנית'}</button>
            </div>
          )}
        </div>
      </section>
    </>
  );
};
