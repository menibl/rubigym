import assert from 'node:assert/strict';
import test from 'node:test';
import { preserveApprovedNutritionTargets, resolveOpenAiApiKey } from './workout-ai.js';

test('reads and trims the OpenAI key from the server environment', () => {
  assert.equal(resolveOpenAiApiKey({ OPENAI_API_KEY: '  server-key-value  ' }), 'server-key-value');
  assert.equal(resolveOpenAiApiKey({}), '');
});

test('preserves approved nutrition targets unless the coach explicitly changes one', () => {
  const approved = { dailyCalories: 1900, proteinGrams: 130, carbsGrams: 180, fatGrams: 60 };
  const generated = { dailyCalories: 2200, proteinGrams: 160, carbsGrams: 230, fatGrams: 75 };

  assert.deepEqual(preserveApprovedNutritionTargets(generated, approved, 'החלף את ארוחת הערב'), approved);
  assert.deepEqual(
    preserveApprovedNutritionTargets(generated, approved, 'עדכן את יעד החלבון ל־150 גרם'),
    { ...approved, proteinGrams: 160 }
  );
});
