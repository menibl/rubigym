import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { handleWorkoutAi } from '../server/workout-ai.js';

const prompt = await readFile(new URL('../server/prompts/workout-coach.md', import.meta.url), 'utf8');
const originalFetch = globalThis.fetch;
let capturedRequest;

globalThis.fetch = async (_url, options) => {
  capturedRequest = JSON.parse(options.body);
  const isNutrition = capturedRequest.text?.format?.name === 'nutrition_plan';
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
      categories: [{ title: 'ארוחת בוקר', suggestedTime: '08:00', foods: 'יוגורט, שיבולת שועל ופרי', calories: 500, proteinGrams: 35, carbsGrams: 55, fatGrams: 15, notes: 'טיוטה' }]
    } : {
      assistantMessage: 'נוצרה טיוטה לבדיקה.',
      focusDay: 2,
      objective: 'כוח בשלושה ימים',
      coachNotes: 'נדרש אישור מאמן.',
      trainingDaysPerWeek: 3,
      dayLabels: ['יום 1', 'יום 2', 'יום 3'],
      exercises: [{
        name: 'סקוואט', category: 'כוח', muscleGroup: 'LEGS', sets: 3, reps: '8',
        weight: 'RPE 7', workDuration: '', restDuration: '90 שניות', notes: 'טכניקה מבוקרת', dayNumber: 2
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
  assert.equal(capturedRequest.store, false);
  assert.ok(!JSON.stringify(capturedRequest).includes('test-key'));

  const nutritionResponse = await handleWorkoutAi(new Request('http://localhost/api/ai/workout-plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
    body: JSON.stringify({
      scope: 'NUTRITION',
      message: 'בנה תוכנית תזונה לארבע ארוחות',
      actor: { id: 'coach-1' },
      trainee: { id: 'trainee-1', age: 32 },
      professionalProfile: { primaryGoal: 'ירידה במשקל' },
      currentDraft: { dailyCalories: 2000, categories: [] }
    })
  }), {
    OPENAI_API_KEY: 'test-key',
    OPENAI_WORKOUT_MODEL: 'test-model',
    AI_ALLOWED_ORIGIN: 'http://localhost:3000'
  }, {}, json);
  assert.equal(nutritionResponse.status, 200);
  const nutritionPayload = await nutritionResponse.json();
  assert.equal(nutritionPayload.result.categories.length, 1);
  assert.equal(capturedRequest.text.format.name, 'nutrition_plan');
  console.log('Workout AI integration test passed');
} finally {
  globalThis.fetch = originalFetch;
}
