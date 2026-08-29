import { workoutCoachPrompt } from './generated/workout-coach-prompt.js';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const requestWindows = new Map();

const hebrewText = description => ({ type: 'string', description });
const visibleHebrewText = hebrewText('טקסט גלוי בעברית בלבד, ללא אותיות לטיניות.');
const hebrewExerciseName = hebrewText('שם תרגיל מקצועי בעברית בלבד. יש לתרגם כל שם באנגלית ואין להשתמש באותיות לטיניות.');

const exerciseProperties = {
  name: hebrewExerciseName,
  category: visibleHebrewText,
  muscleGroup: { type: 'string', enum: ['UPPER', 'LEGS', 'BACK', 'SHOULDERS', 'CORE', 'FUNCTIONAL'] },
  sets: { type: 'integer' },
  reps: hebrewText('מספר חזרות או משך בעברית; מספרים מותרים.'),
  weight: hebrewText('עומס מומלץ בעברית בלבד. יש לכתוב "דרגת מאמץ נתפסת" ולא קיצור באנגלית.'),
  workDuration: hebrewText('זמן עבודה בעברית; מספרים מותרים.'),
  restDuration: hebrewText('זמן מנוחה בעברית; מספרים מותרים.'),
  notes: visibleHebrewText,
  dayNumber: { type: 'integer' }
};

const personalSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['assistantMessage', 'focusDay', 'objective', 'coachNotes', 'trainingDaysPerWeek', 'dayLabels', 'exercises'],
  properties: {
    assistantMessage: visibleHebrewText,
    focusDay: { type: 'integer' },
    objective: visibleHebrewText,
    coachNotes: visibleHebrewText,
    trainingDaysPerWeek: { type: 'integer' },
    dayLabels: { type: 'array', items: visibleHebrewText },
    exercises: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: Object.keys(exerciseProperties),
        properties: exerciseProperties
      }
    }
  }
};

const groupExerciseProperties = {
  ...exerciseProperties,
  workSeconds: { type: 'integer' },
  restSeconds: { type: 'integer' },
  rounds: { type: 'integer' }
};

const groupExerciseSchema = {
  type: 'object',
  additionalProperties: false,
  required: Object.keys(groupExerciseProperties),
  properties: groupExerciseProperties
};

const groupSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'assistantMessage', 'title', 'description', 'mode', 'participantCount',
    'defaultWorkSeconds', 'defaultRestSeconds', 'preparationSeconds',
    'roundsPerStation', 'transitionSeconds', 'exercises', 'stations'
  ],
  properties: {
    assistantMessage: visibleHebrewText,
    title: visibleHebrewText,
    description: visibleHebrewText,
    mode: { type: 'string', enum: ['LINEAR', 'ROTATING_GROUPS'] },
    participantCount: { type: 'integer' },
    defaultWorkSeconds: { type: 'integer' },
    defaultRestSeconds: { type: 'integer' },
    preparationSeconds: { type: 'integer' },
    roundsPerStation: { type: 'integer' },
    transitionSeconds: { type: 'integer' },
    exercises: { type: 'array', items: groupExerciseSchema },
    stations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'exercises'],
        properties: {
          name: visibleHebrewText,
          exercises: { type: 'array', items: groupExerciseSchema }
        }
      }
    }
  }
};

const nutritionMealProperties = {
  title: visibleHebrewText,
  suggestedTime: { type: 'string' },
  foods: visibleHebrewText,
  calories: { type: 'integer' },
  proteinGrams: { type: 'integer' },
  carbsGrams: { type: 'integer' },
  fatGrams: { type: 'integer' },
  notes: visibleHebrewText
};

const nutritionSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['assistantMessage', 'goal', 'dailyCalories', 'proteinGrams', 'carbsGrams', 'fatGrams', 'hydrationLiters', 'fiberGrams', 'coachNotes', 'mealsDescription', 'categories'],
  properties: {
    assistantMessage: visibleHebrewText,
    goal: visibleHebrewText,
    dailyCalories: { type: 'integer' },
    proteinGrams: { type: 'integer' },
    carbsGrams: { type: 'integer' },
    fatGrams: { type: 'integer' },
    hydrationLiters: { type: 'number' },
    fiberGrams: { type: 'integer' },
    coachNotes: visibleHebrewText,
    mealsDescription: visibleHebrewText,
    categories: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: Object.keys(nutritionMealProperties),
        properties: nutritionMealProperties
      }
    }
  }
};

const readOutputText = response => {
  if (typeof response.output_text === 'string' && response.output_text) return response.output_text;
  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (content.type === 'output_text' && content.text) return content.text;
      if (content.type === 'refusal' && content.refusal) throw new Error('OPENAI_REFUSAL');
    }
  }
  throw new Error('OPENAI_EMPTY_RESPONSE');
};

const privacySafeIdentifier = async value => {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value || 'anonymous')));
  return [...new Uint8Array(bytes)].slice(0, 16).map(byte => byte.toString(16).padStart(2, '0')).join('');
};

const enforceRateLimit = (request, env) => {
  const now = Date.now();
  const limit = Math.max(1, Number(env.AI_REQUESTS_PER_HOUR || 30));
  const client = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() || 'local';
  const current = requestWindows.get(client);
  if (!current || now - current.startedAt >= 60 * 60 * 1000) {
    requestWindows.set(client, { startedAt: now, count: 1 });
    return;
  }
  if (current.count >= limit) throw new Error('AI_RATE_LIMIT');
  current.count += 1;
};

const assertAllowedOrigin = (request, env) => {
  const allowed = String(env.AI_ALLOWED_ORIGIN || env.PAYMENT_ALLOWED_ORIGIN || '')
    .split(',').map(value => value.trim()).filter(Boolean);
  const origin = request.headers.get('Origin');
  if (allowed.length && origin && !allowed.includes(origin)) throw new Error('AI_ORIGIN_DENIED');
};

const cleanContext = body => ({
  scope: body.scope,
  request: String(body.message || '').slice(0, 2_000),
  actor: body.actor || {},
  trainee: body.trainee || null,
  professionalProfile: body.professionalProfile || null,
  confirmedMemory: Array.isArray(body.confirmedMemory) ? body.confirmedMemory.slice(0, 50) : [],
  equipment: Array.isArray(body.equipment) ? body.equipment.slice(0, 100) : [],
  sourceDocuments: Array.isArray(body.sourceDocuments)
    ? body.sourceDocuments.slice(0, 5).map(source => ({ ...source, text: String(source.text || '').slice(0, 20_000) }))
    : [],
  conversation: Array.isArray(body.conversation) ? body.conversation.slice(-16) : [],
  currentDraft: body.currentDraft || null,
  groupParticipants: Array.isArray(body.groupParticipants) ? body.groupParticipants.slice(0, 100) : []
});

const internalEnglishFields = new Set(['mode', 'muscleGroup']);

const containsVisibleLatinText = (value, key = '') => {
  if (typeof value === 'string') return !internalEnglishFields.has(key) && /[A-Za-z]/.test(value);
  if (Array.isArray(value)) return value.some(item => containsVisibleLatinText(item, key));
  if (value && typeof value === 'object') {
    return Object.entries(value).some(([childKey, childValue]) => containsVisibleLatinText(childValue, childKey));
  }
  return false;
};

export const resolveOpenAiApiKey = env => String(env?.OPENAI_API_KEY || '').trim();

export const handleWorkoutAi = async (request, env, headers, json) => {
  const apiKey = resolveOpenAiApiKey(env);
  if (!apiKey) return json({ message: 'מפתח OpenAI עדיין לא הוגדר בשרת.' }, 503, headers);
  try {
    assertAllowedOrigin(request, env);
    enforceRateLimit(request, env);
    const body = await request.json();
    if (!['PERSONAL', 'GROUP', 'NUTRITION'].includes(body.scope) || typeof body.message !== 'string' || !body.message.trim()) {
      return json({ message: 'בקשת ה־AI אינה תקינה.' }, 400, headers);
    }
    const context = cleanContext(body);
    const schema = body.scope === 'PERSONAL' ? personalSchema : body.scope === 'GROUP' ? groupSchema : nutritionSchema;
    const schemaName = body.scope === 'PERSONAL' ? 'personal_workout_plan' : body.scope === 'GROUP' ? 'group_workout_plan' : 'nutrition_plan';
    const requestModel = async input => {
      const response = await fetch(OPENAI_RESPONSES_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
        model: env.OPENAI_WORKOUT_MODEL || 'gpt-5-mini',
        store: false,
        safety_identifier: await privacySafeIdentifier(body.actor?.id || body.trainee?.id),
        input,
        text: {
          format: {
            type: 'json_schema',
            name: schemaName,
            strict: true,
            schema
          }
        },
        max_output_tokens: Number(env.OPENAI_WORKOUT_MAX_OUTPUT_TOKENS || 12_000)
      })
      });
      return { response, result: await response.json().catch(() => null) };
    };
    const baseInput = [
      { role: 'system', content: workoutCoachPrompt },
      { role: 'user', content: `עדכן את הטיוטה בהתאם לבקשה ולהקשר הבא. אם זהו שאלון תזונה, החזר הצעה שמרנית לבדיקת איש מקצוע ואישור המאמן בלבד:\n${JSON.stringify(context)}` }
    ];
    let { response: openAiResponse, result } = await requestModel(baseInput);
    if (!openAiResponse.ok || !result) {
      console.error('OpenAI workout request failed', openAiResponse.status, result?.error?.code || result?.error?.message || 'unknown');
      const status = openAiResponse.status === 429 ? 429 : 502;
      const message = openAiResponse.status === 401
        ? 'מפתח OpenAI שמוגדר בשרת אינו תקין.'
        : openAiResponse.status === 404
          ? 'מודל ה־AI שמוגדר בשרת אינו זמין לפרויקט.'
          : status === 429
            ? 'שירות ה־AI עמוס כרגע או שמגבלת התקציב נוצלה. נסו שוב בעוד רגע.'
            : 'שירות ה־AI לא הצליח ליצור תוכנית.';
      return json({ message }, status, headers);
    }
    let parsedResult = JSON.parse(readOutputText(result));
    if (containsVisibleLatinText(parsedResult)) {
      const correctionInput = [
        ...baseInput,
        { role: 'assistant', content: JSON.stringify(parsedResult) },
        { role: 'user', content: 'תקן את הטיוטה והחזר אותה במלואה: כל הטקסט הגלוי וכל שמות התרגילים חייבים להיות בעברית בלבד, ללא אותיות לטיניות. תרגם לעברית כל שם או מונח באנגלית. ערכי הסכמה הפנימיים יישארו ללא שינוי.' }
      ];
      ({ response: openAiResponse, result } = await requestModel(correctionInput));
      if (!openAiResponse.ok || !result) throw new Error('OPENAI_HEBREW_CORRECTION_FAILED');
      parsedResult = JSON.parse(readOutputText(result));
      if (containsVisibleLatinText(parsedResult)) throw new Error('OPENAI_NON_HEBREW_RESPONSE');
    }
    return json({ result: parsedResult, model: result.model || env.OPENAI_WORKOUT_MODEL || 'gpt-5-mini' }, 200, headers);
  } catch (error) {
    const code = error instanceof Error ? error.message : 'UNKNOWN';
    if (code === 'AI_RATE_LIMIT') return json({ message: 'הגעתם למגבלת בקשות ה־AI לשעה. נסו שוב מאוחר יותר.' }, 429, headers);
    if (code === 'AI_ORIGIN_DENIED') return json({ message: 'מקור הבקשה אינו מורשה.' }, 403, headers);
    console.error('OpenAI workout error', code);
    return json({ message: code === 'OPENAI_REFUSAL' ? 'הבקשה לא ניתנת לביצוע. נסחו אותה מחדש.' : 'לא ניתן היה לעבד את תשובת ה־AI.' }, 502, headers);
  }
};
