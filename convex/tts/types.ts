/**
 * TTS provider interface. To add a provider: implement this interface,
 * register it in ./index.ts, and (if needed) add its API key to .env.example.
 * The active provider is chosen by the TTS_PROVIDER env var on the Convex
 * deployment ("elevenlabs" | "openai").
 */
export interface SynthesisResult {
  /** Encoded audio bytes (mp3). */
  data: ArrayBuffer;
  mimeType: string;
  /** Best-effort duration estimate; the client refines it from real metadata. */
  durationSec: number;
}

export interface TtsProvider {
  name: string;
  synthesize(text: string): Promise<SynthesisResult>;
}

/** ~150 wpm conversational speech ≈ 14 characters per second. */
export function estimateSpeechSeconds(text: string): number {
  return Math.max(0.5, text.length / 14);
}
