/**
 * Push server-side secrets from .env / .env.local to the active Convex
 * deployment. Run after editing either file: bun run sync-env
 */
import { $ } from "bun";

const KEYS = [
  "ANTHROPIC_API_KEY",
  "DEEPGRAM_API_KEY",
  "ELEVENLABS_API_KEY",
  "OPENAI_API_KEY",
  "TTS_PROVIDER",
];

const env: Record<string, string> = {};
let foundAny = false;
for (const path of [".env", ".env.local"]) {
  const file = Bun.file(path);
  if (!(await file.exists())) continue;
  foundAny = true;
  for (const line of (await file.text()).split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) env[match[1]] = match[2].trim();
  }
}
if (!foundAny) {
  console.error("No .env or .env.local found. Copy .env.example to .env first.");
  process.exit(1);
}

// Pass --prod to target the production deployment instead of dev.
const target = process.argv.includes("--prod") ? ["--prod"] : [];

for (const key of KEYS) {
  const value = env[key];
  if (value) {
    await $`bunx convex env set ${target} ${key} ${value}`;
    console.log(`set ${key}`);
  } else {
    console.log(`skip ${key} (empty)`);
  }
}
