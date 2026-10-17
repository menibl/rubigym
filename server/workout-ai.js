import { workoutCoachPrompt } from './generated/workout-coach-prompt.js';
import { readOpenAiResponse } from './openai-response.js';

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
  equipment: hebrewText('הציוד המדויק הנדרש לתרגיל בעברית בלבד: מכשיר, מכונה, משקל חופשי, מוצר עזר, ארגז או מדרגה. אם לא נדרש ציוד יש לכתוב "ללא ציוד".'),
  workDuration: hebrewText('זמן עבודה בעברית; מספרים מותרים.'),
  restDuration: hebrewText('זמן מנוחה בעברית; מספרים מותרים.'),
  notes: visibleHebrewText,
  dayNumber: { type: 'integer' }
};

const personalExerciseProperties = {
  ...exerciseProperties,
  stationNumber: { type: 'integer', description: 'מספר התחנה או תת־הקבוצה, החל מ־1. ברצף יש להחזיר 1.' }
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
        required: Object.keys(personalExerciseProperties),
        properties: personalExerciseProperties
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

const readPlanResult = response => {
  const text = readOutputText(response);
  let plan;
  try { plan = JSON.parse(text); }
  catch { throw new Error('OPENAI_INVALID_PLAN_JSON'); }
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) throw new Error('OPENAI_INVALID_PLAN_SHAPE');
  return plan;
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

const nutritionTargetRules = [
  { key: 'dailyCalories', target: /קלורי|קלוריות/ },
  { key: 'proteinGrams', target: /חלבון/ },
  { key: 'carbsGrams', target: /פחמימ/ },
  { key: 'fatGrams', target: /שומן/ }
];

const explicitTargetChange = (message, target) => {
  const text = String(message || '');
  const changeRequest = /שנ(?:ה|י|ו)|עדכ(?:ן|ני|נו)|החל(?:ף|יפי|יפו)|קב(?:ע|עי|עו)|הגד(?:ר|ירי|ירו)|העל(?:ה|י|ו)|הור(?:ד|ידי|ידו)/;
  return changeRequest.test(text) && target.test(text);
};

export const preserveApprovedNutritionTargets = (result, currentDraft, message) => {
  if (!result || !currentDraft) return result;
  const preserved = { ...result };
  nutritionTargetRules.forEach(({ key, target }) => {
    const approvedValue = Number(currentDraft[key]);
    if (Number.isFinite(approvedValue) && approvedValue > 0 && !explicitTargetChange(message, target)) {
      preserved[key] = approvedValue;
    }
  });
  return preserved;
};

export const handleWorkoutAi = async (request, env, headers, json) => {
  const apiKey = resolveOpenAiApiKey(env);
  if (!apiKey) return json({ message: 'מפתח OpenAI עדיין לא הוגדר בשרת.' }, 503, headers);
  let lastDiagnostics;
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
    const requestModel = async (input, stage) => {
      lastDiagnostics = { stage };
      const response = await fetch(OPENAI_RESPONSES_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
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
      const decoded = await readOpenAiResponse(response, stage);
      lastDiagnostics = decoded.diagnostics;
      if (decoded.failure) {
        console.error('OpenAI workout request failed', JSON.stringify({ ...decoded.diagnostics, code: decoded.failure }));
        throw Object.assign(new Error(decoded.failure), { upstreamStatus: response.status, diagnosticLogged: true });
      }
      return { response, result: decoded.result };
    };
    const baseInput = [
      { role: 'system', content: workoutCoachPrompt },
      { role: 'user', content: `עדכן את הטיוטה בהתאם לבקשה ולהקשר הבא. אם זהו שאלון תזונה, החזר הצעה שמרנית לבדיקת איש מקצוע ואישור המאמן בלבד:\n${JSON.stringify(context)}` }
    ];
    let { result } = await requestModel(baseInput, 'generation');
    let parsedResult = readPlanResult(result);
    if (containsVisibleLatinText(parsedResult)) {
      const correctionInput = [
        ...baseInput,
        { role: 'assistant', content: JSON.stringify(parsedResult) },
        { role: 'user', content: 'תקן את הטיוטה והחזר אותה במלואה: כל הטקסט הגלוי וכל שמות התרגילים חייבים להיות בעברית בלבד, ללא אותיות לטיניות. תרגם לעברית כל שם או מונח באנגלית. ערכי הסכמה הפנימיים יישארו ללא שינוי.' }
      ];
      ({ result } = await requestModel(correctionInput, 'hebrew-correction'));
      parsedResult = readPlanResult(result);
      if (containsVisibleLatinText(parsedResult)) throw new Error('OPENAI_NON_HEBREW_RESPONSE');
    }
    if (body.scope === 'NUTRITION') {
      parsedResult = preserveApprovedNutritionTargets(parsedResult, body.currentDraft, body.message);
    }
    return json({ result: parsedResult, model: result.model || env.OPENAI_WORKOUT_MODEL || 'gpt-5-mini' }, 200, headers);
  } catch (error) {
    const knownCodes = new Set(['AI_RATE_LIMIT', 'AI_ORIGIN_DENIED', 'OPENAI_REFUSAL', 'OPENAI_EMPTY_RESPONSE',
      'OPENAI_NON_HEBREW_RESPONSE', 'OPENAI_RESPONSE_READ_FAILED', 'OPENAI_EMPTY_BODY', 'OPENAI_INVALID_JSON',
      'OPENAI_INVALID_RESPONSE_SHAPE', 'OPENAI_REQUEST_REJECTED', 'OPENAI_INVALID_PLAN_JSON', 'OPENAI_INVALID_PLAN_SHAPE']);
    // SyntaxError.message can include model output or personal details.
    const code = error instanceof Error && knownCodes.has(error.message) ? error.message : 'OPENAI_RESPONSE_PROCESSING_FAILED';
    if (code === 'AI_RATE_LIMIT') return json({ message: 'הגעתם למגבלת בקשות ה־AI לשעה. נסו שוב מאוחר יותר.' }, 429, headers);
    if (code === 'AI_ORIGIN_DENIED') return json({ message: 'מקור הבקשה אינו מורשה.' }, 403, headers);
    if (!error?.diagnosticLogged) console.error('OpenAI workout error', JSON.stringify({ ...lastDiagnostics, code }));
    const status = error?.upstreamStatus === 429 ? 429 : 502;
    const message = error?.upstreamStatus === 401 ? 'מפתח OpenAI שמוגדר בשרת אינו תקין.'
      : error?.upstreamStatus === 404 ? 'מודל ה־AI שמוגדר בשרת אינו זמין לפרויקט.'
      : status === 429 ? 'שירות ה־AI עמוס כרגע או שמגבלת התקציב נוצלה. נסו שוב בעוד רגע.'
      : code === 'OPENAI_EMPTY_BODY' ? 'התקבלה תשובה ריקה משירות ה־AI. לא נוצרה תוכנית; ניתן לנסות שוב.'
      : ['OPENAI_INVALID_JSON', 'OPENAI_INVALID_RESPONSE_SHAPE', 'OPENAI_INVALID_PLAN_JSON', 'OPENAI_INVALID_PLAN_SHAPE'].includes(code) ? 'שירות ה־AI החזיר תשובה בפורמט לא תקין. לא נוצרה תוכנית; ניתן לנסות שוב.'
      : code === 'OPENAI_RESPONSE_READ_FAILED' ? 'קריאת תשובת ה־AI נכשלה או נקטעה. לא נוצרה תוכנית; ניתן לנסות שוב.'
      : code === 'OPENAI_REFUSAL' ? 'הבקשה לא ניתנת לביצוע. נסחו אותה מחדש.' : 'לא ניתן היה לעבד את תשובת ה־AI.';
    return json({ message, code }, status, headers);
  }
};
