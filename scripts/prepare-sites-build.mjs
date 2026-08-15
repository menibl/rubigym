import { cp, mkdir } from "node:fs/promises";

await mkdir("dist/server", { recursive: true });
await mkdir("dist/server/generated", { recursive: true });
await mkdir("dist/.openai", { recursive: true });
await mkdir("dist/client", { recursive: true });
await cp("server/index.js", "dist/server/index.js");
await cp("server/workout-ai.js", "dist/server/workout-ai.js");
await cp("server/generated/workout-coach-prompt.js", "dist/server/generated/workout-coach-prompt.js");
await cp(".openai/hosting.json", "dist/.openai/hosting.json");
await cp("dist/index.html", "dist/client/index.html");
await cp("dist/assets", "dist/client/assets", { recursive: true });
