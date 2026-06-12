import { DEFAULT_TTS_PROVIDER, type TtsProviderName } from "../appConfig";
import { elevenLabsProvider } from "./elevenlabs";
import { openAiProvider } from "./openai";
import type { TtsProvider } from "./types";

const PROVIDERS: Record<TtsProviderName, TtsProvider> = {
  elevenlabs: elevenLabsProvider,
  openai: openAiProvider,
};

/** Resolve the active TTS provider from the deployment's TTS_PROVIDER env var. */
export function getTtsProvider(): TtsProvider {
  const name = (process.env.TTS_PROVIDER ?? DEFAULT_TTS_PROVIDER) as TtsProviderName;
  const provider = PROVIDERS[name];
  if (!provider) {
    throw new Error(
      `Unknown TTS_PROVIDER "${name}" — expected one of: ${Object.keys(PROVIDERS).join(", ")}`,
    );
  }
  return provider;
}
