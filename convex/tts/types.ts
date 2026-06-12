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
  /**
   * Provider-assigned id for this generation, if exposed. Fed back as
   * `previousRequestIds` on the next chunk so providers that support request
   * stitching (ElevenLabs) keep loudness/prosody consistent across chunks.
   */
  requestId?: string;
}

/**
 * Continuity context for chunked synthesis. Chunks of one message are
 * synthesized as separate requests; without this, each request gets an
 * independent loudness/prosody "take" and the seams are audible.
 */
export interface SynthesisContext {
  /** Text of the chunk immediately before this one. */
  previousText?: string;
  /** requestIds of recent prior chunks, oldest first (callers keep ≤3). */
  previousRequestIds?: string[];
}

export interface TtsProvider {
  name: string;
  synthesize(text: string, context?: SynthesisContext): Promise<SynthesisResult>;
}

/** ~150 wpm conversational speech ≈ 14 characters per second. */
export function estimateSpeechSeconds(text: string): number {
  return Math.max(0.5, text.length / 14);
}
