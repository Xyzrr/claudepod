import { OPENAI_TTS_MODEL, OPENAI_TTS_VOICE } from "../appConfig";
import { estimateSpeechSeconds, type TtsProvider } from "./types";

/** Cost fallback for ElevenLabs. Enabled with TTS_PROVIDER=openai. */
export const openAiProvider: TtsProvider = {
  name: "openai",
  async synthesize(text) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY is not set on the Convex deployment but TTS_PROVIDER=openai (run `bun run sync-env`)",
      );
    }
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_TTS_MODEL,
        voice: OPENAI_TTS_VOICE,
        input: text,
        response_format: "mp3",
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI TTS failed (${response.status}): ${body}`);
    }
    const data = await response.arrayBuffer();
    return { data, mimeType: "audio/mpeg", durationSec: estimateSpeechSeconds(text) };
  },
};
