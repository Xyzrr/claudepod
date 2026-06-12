import { useMemo, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import { usePlayer } from "../lib/player";
import { estimateSpeechSeconds, formatTime } from "../lib/format";

/**
 * An assistant response rendered as flowing text. Each TTS sentence-chunk is
 * a tappable span: tapping seeks playback to that chunk, and the chunk being
 * spoken is highlighted karaoke-style. Audio control lives in the single
 * NowPlayingBar; here there is just one small play/pause affordance.
 */
export default function AssistantMessage({
  message,
  chapterNumber,
  conversationTitle,
}: {
  message: Doc<"messages">;
  chapterNumber: number;
  conversationTitle: string;
}) {
  const player = usePlayer();
  const regenerate = useAction(api.ai.regenerateAudio);
  const [regenerating, setRegenerating] = useState(false);

  const segments = useQuery(api.audio.getSegments, { messageId: message._id }) ?? [];
  const isActive = player.activeMessageId === message._id;
  const isPlaying = isActive && (player.playing || player.buffering);

  const generating = message.status === "pending" || message.status === "streaming";
  const synthesizing = segments.some((s) => s.status === "pending");
  const hasAudio = segments.some((s) => s.status === "ready");
  const audioFailed =
    !generating &&
    !synthesizing &&
    !hasAudio &&
    (message.status === "complete" || segments.length > 0);

  const total = segments.reduce(
    (sum, s) => sum + (s.durationSec ?? estimateSpeechSeconds(s.text)),
    0,
  );

  const meta = { title: conversationTitle };

  // Lay the segments over the raw content so we can render chunk spans plus
  // any still-unchunked tail while streaming.
  type Part =
    | { kind: "chunk"; text: string; index: number }
    | { kind: "plain"; text: string };
  const parts = useMemo<Part[]>(() => {
    const content = message.content;
    const ordered = [...segments].sort((a, b) => a.index - b.index);
    const out: Part[] = [];
    let cursor = 0;
    for (const segment of ordered) {
      const at = content.indexOf(segment.text, cursor);
      if (at === -1) {
        // Content was edited/trimmed differently — still render the chunk.
        out.push({ kind: "chunk", text: segment.text, index: segment.index });
        continue;
      }
      if (at > cursor) out.push({ kind: "plain", text: content.slice(cursor, at) });
      out.push({ kind: "chunk", text: segment.text, index: segment.index });
      cursor = at + segment.text.length;
    }
    if (cursor < content.length) out.push({ kind: "plain", text: content.slice(cursor) });
    return out;
  }, [message.content, segments]);

  return (
    <article className={`answer ${isActive ? "answer-active" : ""}`}>
      <div className="answer-head">
        <button
          className={`answer-play ${isPlaying ? "playing" : ""}`}
          aria-label={isPlaying ? "Pause" : "Listen"}
          disabled={!hasAudio && !generating && !synthesizing}
          onClick={() => player.toggle(message._id, meta)}
        >
          {isPlaying ? "❚❚" : "▶"}
        </button>
        <span className="answer-label">
          Chapter {chapterNumber}
          {total > 1 && <> · {formatTime(total)}</>}
          {generating && <span className="answer-state"> · generating…</span>}
          {!generating && synthesizing && !hasAudio && (
            <span className="answer-state"> · preparing audio…</span>
          )}
          {isActive && player.buffering && !generating && hasAudio && (
            <span className="answer-state"> · buffering…</span>
          )}
        </span>
      </div>

      <p className="answer-text">
        {parts.length === 0 && (message.content || (generating ? "…" : ""))}
        {parts.map((part, i) =>
          part.kind === "chunk" ? (
            <span
              key={i}
              role="button"
              tabIndex={0}
              className={`chunk ${
                isActive && player.activeSegmentIndex === part.index && isPlaying
                  ? "chunk-active"
                  : ""
              }`}
              onClick={() => player.seekToSegment(message._id, part.index, meta)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  player.seekToSegment(message._id, part.index, meta);
                }
              }}
            >
              {part.text}
            </span>
          ) : (
            <span key={i}>{part.text}</span>
          ),
        )}
      </p>

      {audioFailed && (
        <button
          className="btn-link"
          disabled={regenerating}
          onClick={() => {
            setRegenerating(true);
            void regenerate({ messageId: message._id }).finally(() =>
              setRegenerating(false),
            );
          }}
        >
          {regenerating ? "Regenerating audio…" : "Audio unavailable — regenerate"}
        </button>
      )}
      {message.status === "error" && (
        <p className="form-error">{message.error ?? "Something went wrong."}</p>
      )}
    </article>
  );
}
