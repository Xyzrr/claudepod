import { TTS_CHUNKING } from "../appConfig";

/**
 * Incremental sentence chunker for streaming TTS.
 *
 * Feed it text deltas as they arrive from Claude; it emits chunks that end on
 * sentence boundaries. The first chunk is allowed to be small so audio starts
 * early; later chunks are larger so the synthesized voice keeps its prosody.
 */
export class SentenceChunker {
  private buffer = "";
  private emittedAny = false;

  push(delta: string): string[] {
    this.buffer += delta;
    const chunks: string[] = [];
    for (;;) {
      const chunk = this.tryExtract();
      if (chunk === null) break;
      chunks.push(chunk);
    }
    return chunks;
  }

  /** Whatever is left when the stream ends. */
  flush(): string | null {
    const rest = this.buffer.trim();
    this.buffer = "";
    if (rest.length === 0) return null;
    this.emittedAny = true;
    return rest;
  }

  private tryExtract(): string | null {
    const minChars = this.emittedAny
      ? TTS_CHUNKING.minChars
      : TTS_CHUNKING.firstChunkMinChars;
    const maxChars = this.emittedAny
      ? TTS_CHUNKING.maxChars
      : TTS_CHUNKING.firstChunkMaxChars;

    if (this.buffer.trim().length < minChars) return null;

    // Find the last sentence boundary within maxChars (or anywhere past min).
    const searchRegion = this.buffer.slice(0, maxChars + 80);
    let cut = -1;
    const boundary = /[.!?…]["')\]]?(\s|$)/g;
    let match: RegExpExecArray | null;
    while ((match = boundary.exec(searchRegion)) !== null) {
      const end = match.index + match[0].length;
      if (end >= minChars) {
        cut = end;
        break; // earliest boundary past the minimum keeps latency low
      }
      cut = end; // remember the latest boundary before the minimum as fallback
    }

    if (cut < minChars) {
      // No usable boundary yet. If the buffer is huge, hard-cut on whitespace
      // so a single run-on passage can't stall the audio pipeline.
      if (this.buffer.length < maxChars * 2) return null;
      const space = this.buffer.lastIndexOf(" ", maxChars);
      cut = space > minChars ? space : maxChars;
    }

    const chunk = this.buffer.slice(0, cut).trim();
    this.buffer = this.buffer.slice(cut);
    if (chunk.length === 0) return null;
    this.emittedAny = true;
    return chunk;
  }
}
