// Central app configuration. Shared by Convex functions and (where harmless)
// the web client. Secrets never live here — they live in Convex deployment
// env vars (see .env.example and scripts/sync-env.ts).

/** The one place the Claude model is configured. */
export const CLAUDE_MODEL = "claude-fable-5";

/** Cap on a single spoken answer. Long-form, but not unbounded. */
export const MAX_RESPONSE_TOKENS = 8000;

/** TTS provider switch. Set TTS_PROVIDER=openai on the Convex deployment to fall back. */
export type TtsProviderName = "elevenlabs" | "openai";
export const DEFAULT_TTS_PROVIDER: TtsProviderName = "elevenlabs";

export const ELEVENLABS_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"; // "George" — warm narration voice
export const ELEVENLABS_MODEL_ID = "eleven_multilingual_v2";
// mp3 44.1kHz @ 128kbps CBR — lets us derive duration from byte length.
export const ELEVENLABS_OUTPUT_FORMAT = "mp3_44100_128";

export const OPENAI_TTS_MODEL = "gpt-4o-mini-tts";
export const OPENAI_TTS_VOICE = "alloy";

/**
 * Sentence-chunking for streaming TTS. The first chunk is small so playback
 * starts soon; later chunks are bigger so the voice flows naturally.
 */
export const TTS_CHUNKING = {
  firstChunkMaxChars: 280,
  minChars: 200,
  maxChars: 700,
};

/** Client defaults (user-tunable in Settings, persisted in Convex). */
export const DEFAULT_SILENCE_MS = 2750; // how long you must be quiet before we send
export const MIN_SILENCE_MS = 1500;
export const MAX_SILENCE_MS = 5000;
export const DEFAULT_PLAYBACK_RATE = 1;
export const PLAYBACK_RATES = [0.8, 1, 1.2, 1.5, 1.75, 2] as const;

/** Loose matcher for the spoken interrupt command while audio is playing. */
export const STOP_COMMAND_REGEX = /(^|\b)(ok(ay)?[,!\s]*|claude[,!\s]*|hey[,!\s]*)*stop\b/i;
