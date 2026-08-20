import { mkdir, readFile, writeFile } from 'node:fs/promises';

const sourcePath = new URL('../server/prompts/workout-coach.md', import.meta.url);
const outputPath = new URL('../server/generated/workout-coach-prompt.js', import.meta.url);
const prompt = (await readFile(sourcePath, 'utf8')).replace(/\r\n/g, '\n');

await mkdir(new URL('../server/generated/', import.meta.url), { recursive: true });
await writeFile(
  outputPath,
  `// Generated from server/prompts/workout-coach.md. Do not edit directly.\nexport const workoutCoachPrompt = ${JSON.stringify(prompt)};\n`,
  'utf8'
);
