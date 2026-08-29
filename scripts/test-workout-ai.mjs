import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { handleWorkoutAi } from '../server/workout-ai.js';

const prompt = (await readFile(new URL('../server/prompts/workout-coach.md', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
const originalFetch = globalThis.fetch;
let capturedRequest;
let fetchCount = 0;
let returnEnglishOnce = false;

assert.match(prompt, /שמות תרגילים חייבים להיות בעברית/);
assert.match(prompt, /לפחות כשני שלישים מהתרגילים יהיו מבוססי מכשירים/);
assert.match(prompt, /חלבון מן החי בלבד/);
assert.match(prompt, /אין לשנות אף אחד מהם/);
assert.match(prompt, /בכל תרגיל חובה לציין בשדה הציוד/);
assert.doesNotMatch(prompt, /למעט שמות תרגילים מקובלים באנגלית/);

globalThis.fetch = async (_url, options) => {
  fetchCount += 1;
  capturedRequest = JSON.parse(options.body);
  const isNutrition = capturedRequest.text?.format?.name === 'nutrition_plan';
  if (returnEnglishOnce) {
    returnEnglishOnce = false;
    return new Response(JSON.stringify({
      model: 'test-model',
      output_text: JSON.stringify({
        assistantMessage: 'Draft created.',
        focusDay: 1,
        objective: 'Strength',
        coachNotes: 'Coach review required.',
        trainingDaysPerWeek: 1,
        dayLabels: ['Day 1'],
        exercises: [{
          name: 'Leg Press', category: 'Strength', muscleGroup: 'LEGS', sets: 3, reps: '8',
          weight: 'RPE 7', equipment: 'Leg press machine', workDuration: '', restDuration: '90 שניות', notes: 'Controlled movement', dayNumber: 1, stationNumber: 1
        }]
      })
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  return new Response(JSON.stringify({
    model: 'test-model',
    output_text: JSON.stringify(isNutrition ? {
      assistantMessage: 'נוצרה טיוטת תזונה לבדיקה.',
      goal: 'ירידה במשקל',
      dailyCalories: 2000,
      proteinGrams: 140,
      carbsGrams: 210,
      fatGrams: 65,
      hydrationLiters: 2.5,
      fiberGrams: 30,
      coachNotes: 'נדרש אישור מקצועי.',
      mealsDescription: 'ארבע ארוחות ביום',
      categories: [{ title: 'ארוחת בוקר', suggestedTime: '08:00', foods: 'יוגורט 200 גרם, שיבולת שועל 50 גרם ופרי אחד', calories: 500, proteinGrams: 35, carbsGrams: 55, fatGrams: 15, notes: 'טיוטה' }]
    } : {
      assistantMessage: 'נוצרה טיוטה לבדיקה.',
      focusDay: 2,
      objective: 'כוח בשלושה ימים',
      coachNotes: 'נדרש אישור מאמן.',
      trainingDaysPerWeek: 3,
      dayLabels: ['יום 1', 'יום 2', 'יום 3'],
      exercises: [{
        name: 'סקוואט', category: 'כוח', muscleGroup: 'LEGS', sets: 3, reps: '8',
        weight: 'דרגת מאמץ נתפסת 7', equipment: 'כלוב סקוואט ומוט אולימפי', workDuration: '', restDuration: '90 שניות', notes: 'טכניקה מבוקרת', dayNumber: 2, stationNumber: 1
      }]
    })
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json', ...headers }
});

try {
  const response = await handleWorkoutAi(new Request('http://localhost/api/ai/workout-plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
    body: JSON.stringify({
      scope: 'PERSONAL',
      message: 'ביום השני החלף בטן בסקוואט',
      actor: { id: 'coach-1' },
      trainee: { id: 'trainee-1', age: 32 },
      professionalProfile: { limitations: 'כאבי ברכיים' },
      confirmedMemory: [{ category: 'LIMITATION', content: 'רגישות בברך' }],
      equipment: [{ name: 'כלוב סקוואט', status: 'AVAILABLE' }],
      currentDraft: { trainingDaysPerWeek: 3 }
    })
  }), {
    OPENAI_API_KEY: 'test-key',
    OPENAI_WORKOUT_MODEL: 'test-model',
    AI_ALLOWED_ORIGIN: 'http://localhost:3000'
  }, {}, json);

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.result.trainingDaysPerWeek, 3);
  assert.equal(payload.result.focusDay, 2);
  assert.equal(capturedRequest.input[0].content, prompt);
  assert.equal(capturedRequest.text.format.type, 'json_schema');
  assert.equal(capturedRequest.text.format.strict, true);
  assert.match(capturedRequest.text.format.schema.properties.exercises.items.properties.name.description, /בעברית בלבד/);
  assert.ok(capturedRequest.text.format.schema.properties.exercises.items.properties.stationNumber);
  assert.ok(capturedRequest.text.format.schema.properties.exercises.items.properties.equipment);
  assert.equal(capturedRequest.store, false);
  assert.ok(!JSON.stringify(capturedRequest).includes('test-key'));
  assert.equal(fetchCount, 1);

  const nutritionResponse = await handleWorkoutAi(new Request('http://localhost/api/ai/workout-plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
    body: JSON.stringify({
      scope: 'NUTRITION',
      message: 'בנה תוכנית תזונה לארבע ארוחות',
      actor: { id: 'coach-1' },
      trainee: { id: 'trainee-1', age: 32 },
      professionalProfile: { primaryGoal: 'ירידה במשקל' },
      currentDraft: { dailyCalories: 1800, proteinGrams: 120, carbsGrams: 170, fatGrams: 55, categories: [] }
    })
  }), {
    OPENAI_API_KEY: 'test-key',
    OPENAI_WORKOUT_MODEL: 'test-model',
    AI_ALLOWED_ORIGIN: 'http://localhost:3000'
  }, {}, json);
  assert.equal(nutritionResponse.status, 200);
  const nutritionPayload = await nutritionResponse.json();
  assert.equal(nutritionPayload.result.categories.length, 1);
  assert.equal(nutritionPayload.result.dailyCalories, 1800);
  assert.equal(nutritionPayload.result.proteinGrams, 120);
  assert.equal(nutritionPayload.result.carbsGrams, 170);
  assert.equal(nutritionPayload.result.fatGrams, 55);
  assert.equal(capturedRequest.text.format.name, 'nutrition_plan');
  assert.equal(fetchCount, 2);

  returnEnglishOnce = true;
  const correctedResponse = await handleWorkoutAi(new Request('http://localhost/api/ai/workout-plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
    body: JSON.stringify({
      scope: 'PERSONAL',
      message: 'בנה תוכנית כוח',
      actor: { id: 'coach-1' },
      trainee: { id: 'trainee-1', age: 32 },
      equipment: [{ name: 'מכשיר לחיצת רגליים', status: 'AVAILABLE' }]
    })
  }), {
    OPENAI_API_KEY: 'test-key',
    OPENAI_WORKOUT_MODEL: 'test-model',
    AI_ALLOWED_ORIGIN: 'http://localhost:3000'
  }, {}, json);
  assert.equal(correctedResponse.status, 200);
  const correctedPayload = await correctedResponse.json();
  assert.equal(correctedPayload.result.exercises[0].name, 'סקוואט');
  assert.equal(fetchCount, 4);
  assert.equal(capturedRequest.input.at(-1).role, 'user');
  assert.match(capturedRequest.input.at(-1).content, /בעברית בלבד/);
  console.log('Workout AI integration test passed');
} finally {
  globalThis.fetch = originalFetch;
}
