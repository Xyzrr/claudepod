import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import { usePlayer } from "../lib/player";
import { estimateSpeechSeconds, formatTime } from "../lib/format";
import { PLAYBACK_RATES } from "../../convex/appConfig";

/**
 * One assistant response rendered as an audio "chapter": play/pause, scrubber
 * with elapsed/remaining, ±15/30s skips, speed control, collapsed transcript.
 */
export default function ChapterPlayer({
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

  const localTotal = segments.reduce(
    (sum, s) => sum + (s.durationSec ?? estimateSpeechSeconds(s.text)),
    0,
  );
  const total = isActive ? player.total : localTotal;
  const elapsed = isActive ? Math.min(player.elapsed, total) : 0;

  const generating = message.status === "pending" || message.status === "streaming";
  const hasAudio = segments.some((s) => s.status === "ready");
  const audioFailed =
    !generating && !hasAudio && (message.status === "complete" || segments.length > 0);

  return (
    <article className={`chapter ${isActive ? "chapter-active" : ""}`}>
      <div className="chapter-top">
        <span className="chapter-label">
          Chapter {chapterNumber}
          {generating && <span className="chapter-generating"> · generating…</span>}
        </span>
        {isActive && player.buffering && <span className="chapter-buffering">buffering</span>}
      </div>

      <div className="chapter-controls">
        <button
          className="skip-btn"
          aria-label="Back 15 seconds"
          disabled={!isActive}
          onClick={() => player.skip(-15)}
        >
          ↺15
        </button>
        <button
          className={`play-btn ${isPlaying ? "playing" : ""}`}
          aria-label={isPlaying ? "Pause" : "Play"}
          disabled={!hasAudio && !generating}
          onClick={() => player.toggle(message._id, { title: conversationTitle })}
        >
          {isPlaying ? "❚❚" : "▶"}
        </button>
        <button
          className="skip-btn"
          aria-label="Forward 30 seconds"
          disabled={!isActive}
          onClick={() => player.skip(30)}
        >
          30↻
        </button>
        <button
          className="rate-btn"
          aria-label="Playback speed"
          onClick={() => {
            const index = PLAYBACK_RATES.indexOf(
              player.rate as (typeof PLAYBACK_RATES)[number],
            );
            const next = PLAYBACK_RATES[(index + 1) % PLAYBACK_RATES.length];
            player.setRate(next);
          }}
        >
          {player.rate}×
        </button>
      </div>

      <div className="chapter-scrub">
        <input
          type="range"
          min={0}
          max={Math.max(1, Math.round(total * 10))}
          value={Math.round(elapsed * 10)}
          disabled={!isActive || total === 0}
          onChange={(e) => player.seekTo(Number(e.target.value) / 10)}
          aria-label="Seek"
        />
        <div className="chapter-times">
          <span>{formatTime(elapsed)}</span>
          <span>
            {generating && "~"}-{formatTime(Math.max(0, total - elapsed))}
          </span>
        </div>
      </div>

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

      <details className="transcript">
        <summary>Transcript</summary>
        <p>{message.content || "…"}</p>
      </details>
    </article>
  );
}
