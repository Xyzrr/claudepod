import {
  ELEVENLABS_MODEL_ID,
  ELEVENLABS_OUTPUT_FORMAT,
  ELEVENLABS_VOICE_ID,
} from "../appConfig";
import { estimateSpeechSeconds, type TtsProvider } from "./types";

export const elevenLabsProvider: TtsProvider = {
  name: "elevenlabs",
  async synthesize(text, context) {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ELEVENLABS_API_KEY is not set on the Convex deployment (run `bun run sync-env`)",
      );
    }
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}?output_format=${ELEVENLABS_OUTPUT_FORMAT}`;
    const request = (body: Record<string, unknown>) =>
      fetch(url, {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify(body),
      });

    // Request stitching: conditioning on the previous chunk's text and
    // request ids keeps loudness/prosody consistent across chunk boundaries.
    const previousRequestIds = (context?.previousRequestIds ?? []).slice(-3);
    const stitch: Record<string, unknown> = {};
    if (context?.previousText) stitch.previous_text = context.previousText;
    if (previousRequestIds.length > 0) {
      stitch.previous_request_ids = previousRequestIds;
    }

    let response = await request({
      text,
      model_id: ELEVENLABS_MODEL_ID,
      ...stitch,
    });
    if (!response.ok && Object.keys(stitch).length > 0) {
      // A stale/ineligible stitching context (expired request ids, plan
      // restrictions) must not fail the chunk — retry unstitched.
      response = await request({ text, model_id: ELEVENLABS_MODEL_ID });
    }
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`ElevenLabs TTS failed (${response.status}): ${body}`);
    }
    const requestId = response.headers.get("request-id") ?? undefined;
    const data = await response.arrayBuffer();
    // mp3_44100_128 is CBR 128kbps → 16,000 bytes per second.
    const durationSec = data.byteLength > 0
      ? data.byteLength / 16000
      : estimateSpeechSeconds(text);
    return { data, mimeType: "audio/mpeg", durationSec, requestId };
  },
};
