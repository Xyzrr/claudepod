import { usePlayer } from "../lib/player";
import { formatTime } from "../lib/format";
import { PLAYBACK_RATES } from "../../convex/appConfig";

/**
 * The single audio control surface. Only one track can sound at a time, so
 * scrubber, skips, and speed live here — docked above the mic, where the
 * thumb already is.
 */
export default function NowPlayingBar({ label }: { label: string | null }) {
  const player = usePlayer();
  if (!player.activeMessageId) return null;
  const { playing, buffering, elapsed, total, rate } = player;
  const messageId = player.activeMessageId;

  return (
    <div className="nowplaying">
      <div className="np-top">
        <span className="np-label">
          {label ?? "Now playing"}
          {buffering && <span className="np-buffering"> · buffering…</span>}
        </span>
        <span className="np-times">
          {formatTime(Math.min(elapsed, total))} · -{formatTime(Math.max(0, total - elapsed))}
        </span>
      </div>
      <input
        className="np-scrub"
        type="range"
        min={0}
        max={Math.max(1, Math.round(total * 10))}
        value={Math.round(Math.min(elapsed, total) * 10)}
        onChange={(e) => player.seekTo(Number(e.target.value) / 10)}
        aria-label="Seek"
      />
      <div className="np-controls">
        <button className="skip-btn" aria-label="Back 15 seconds" onClick={() => player.skip(-15)}>
          ↺15
        </button>
        <button
          className="np-play"
          aria-label={playing || buffering ? "Pause" : "Play"}
          onClick={() => player.toggle(messageId)}
        >
          {playing || buffering ? "❚❚" : "▶"}
        </button>
        <button className="skip-btn" aria-label="Forward 30 seconds" onClick={() => player.skip(30)}>
          30↻
        </button>
        <button
          className="rate-btn"
          aria-label="Playback speed"
          onClick={() => {
            const index = PLAYBACK_RATES.indexOf(rate as (typeof PLAYBACK_RATES)[number]);
            const next = PLAYBACK_RATES[(index + 1) % PLAYBACK_RATES.length];
            player.setRate(next);
          }}
        >
          {rate}×
        </button>
      </div>
    </div>
  );
}
