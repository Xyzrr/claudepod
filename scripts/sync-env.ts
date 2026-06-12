/**
 * Push server-side secrets from .env to the active Convex deployment.
 * Run after editing .env: bun run sync-env
 */
import { $ } from "bun";

const KEYS = [
  "ANTHROPIC_API_KEY",
  "DEEPGRAM_API_KEY",
  "ELEVENLABS_API_KEY",
  "OPENAI_API_KEY",
  "TTS_PROVIDER",
];

const envFile = Bun.file(".env");
if (!(await envFile.exists())) {
  console.error("No .env file found. Copy .env.example to .env first.");
  process.exit(1);
}

const env: Record<string, string> = {};
for (const line of (await envFile.text()).split("\n")) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match) env[match[1]] = match[2].trim();
}

for (const key of KEYS) {
  const value = env[key];
  if (value) {
    await $`bunx convex env set ${key} ${value}`;
    console.log(`set ${key}`);
  } else {
    console.log(`skip ${key} (empty)`);
  }
}
