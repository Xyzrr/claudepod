import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { estimateSpeechSeconds } from "./format";

/**
 * One app-wide HTMLAudioElement (required for reliable iOS Safari playback:
 * the element is "unlocked" by a user gesture once, then reused for every
 * segment). Assistant messages are played as a sequence of TTS segments that
 * this provider presents as a single continuous timeline.
 */

// A ~0.05s silent mp3, used to unlock the audio element inside a user gesture.
const SILENT_MP3 =
  "data:audio/mpeg;base64,/+MYxAAAAANIAAAAAExBTUUzLjk4LjIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/+MYxDsAAANIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

type Segment = {
  _id: Id<"audioSegments">;
  index: number;
  text: string;
  status: "pending" | "ready" | "error";
  durationSec?: number;
  url: string | null;
};

export type PlayerMeta = { title?: string };

type PlayerState = {
  activeMessageId: Id<"messages"> | null;
  /** Index of the segment currently sounding (only meaningful when active). */
  activeSegmentIndex: number;
  playing: boolean;
  /** True when we're between segments waiting for the next one's TTS. */
  buffering: boolean;
  elapsed: number;
  total: number;
  rate: number;
  segments: Segment[];
};

type PlayerApi = PlayerState & {
  playMessage: (messageId: Id<"messages">, meta?: PlayerMeta) => void;
  toggle: (messageId: Id<"messages">, meta?: PlayerMeta) => void;
  /** Tap-to-seek: jump to a specific sentence-chunk of a message. */
  seekToSegment: (
    messageId: Id<"messages">,
    index: number,
    meta?: PlayerMeta,
  ) => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
  skip: (deltaSeconds: number) => void;
  setRate: (rate: number) => void;
  /** Unlock audio inside any user gesture (send button, mic toggle, …). */
  unlock: () => void;
  /**
   * Re-assert the intended play/pause state onto the element. Mic capture
   * starting/stopping makes iOS reconfigure the audio session, which can
   * pause (or resume) the element behind our back.
   */
  resync: () => void;
};

const PlayerContext = createContext<PlayerApi | null>(null);

export function usePlayer(): PlayerApi {
  const value = useContext(PlayerContext);
  if (!value) throw new Error("usePlayer must be used inside <PlayerProvider>");
  return value;
}

function segmentDuration(segment: Segment): number {
  return segment.durationSec ?? estimateSpeechSeconds(segment.text);
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const unlockedRef = useRef(false);

  const [activeMessageId, setActiveMessageId] = useState<Id<"messages"> | null>(null);
  const [segIndex, setSegIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [rate, setRateState] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const metaRef = useRef<PlayerMeta>({});
  // When a segment we want isn't ready yet, remember it and start as soon as
  // the reactive query delivers its URL.
  const waitingForIndexRef = useRef<number | null>(null);
  const pendingSeekRef = useRef<number | null>(null);

  const setSegmentDuration = useMutation(api.audio.setSegmentDuration);

  const segments =
    useQuery(
      api.audio.getSegments,
      activeMessageId ? { messageId: activeMessageId } : "skip",
    ) ?? [];

  const segmentsRef = useRef<Segment[]>(segments);
  segmentsRef.current = segments;
  // Set after the activeMessage query below; read inside audio event handlers.
  const activeMessageStatusRef = useRef<string | null>(null);
  const segIndexRef = useRef(segIndex);
  segIndexRef.current = segIndex;
  const rateRef = useRef(rate);
  rateRef.current = rate;
  const playingRef = useRef(playing);
  playingRef.current = playing;

  function audio(): HTMLAudioElement {
    if (!audioRef.current) {
      const el = new Audio();
      el.preload = "auto";
      (el as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
      audioRef.current = el;
    }
    return audioRef.current;
  }

  const unlock = useCallback(() => {
    if (unlockedRef.current) return;
    unlockedRef.current = true;
    const el = audio();
    el.src = SILENT_MP3;
    void el.play().catch(() => {});
  }, []);

  const playSegmentAt = useCallback((index: number, offsetSec = 0) => {
    const segment = segmentsRef.current[index];
    const el = audio();
    setSegIndex(index);
    if (!segment || !segment.url) {
      // Not synthesized yet — wait for the reactive query to deliver it.
      waitingForIndexRef.current = index;
      pendingSeekRef.current = offsetSec;
      setBuffering(true);
      el.pause();
      return;
    }
    waitingForIndexRef.current = null;
    setBuffering(false);
    el.src = segment.url;
    el.playbackRate = rateRef.current;
    if (offsetSec > 0.05) {
      const onMeta = () => {
        el.currentTime = Math.min(offsetSec, (el.duration || offsetSec) - 0.05);
        el.removeEventListener("loadedmetadata", onMeta);
      };
      el.addEventListener("loadedmetadata", onMeta);
    }
    setPlaying(true);
    void el.play().catch(() => setPlaying(false));
  }, []);

  // Wire up the shared element's events once.
  useEffect(() => {
    const el = audio();
    const onTime = () => setCurrentTime(el.currentTime);
    const onEnded = () => {
      const next = segIndexRef.current + 1;
      if (next < segmentsRef.current.length) {
        playSegmentAt(next);
        return;
      }
      const status = activeMessageStatusRef.current;
      const generationDone = status !== "streaming" && status !== "pending";
      if (generationDone) {
        // That was the last segment — stop cleanly (mic returns to prompt mode).
        waitingForIndexRef.current = null;
        setBuffering(false);
        setPlaying(false);
        return;
      }
      // The message is still streaming — wait for the next segment; the
      // segments effect below resumes when it arrives.
      waitingForIndexRef.current = next;
      setBuffering(true);
    };
    const onMeta = () => {
      const segment = segmentsRef.current[segIndexRef.current];
      if (
        segment &&
        Number.isFinite(el.duration) &&
        el.duration > 0 &&
        Math.abs((segment.durationSec ?? 0) - el.duration) > 0.4
      ) {
        void setSegmentDuration({ segmentId: segment._id, durationSec: el.duration });
      }
    };
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("ended", onEnded);
    el.addEventListener("loadedmetadata", onMeta);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("loadedmetadata", onMeta);
    };
  }, [playSegmentAt, setSegmentDuration]);

  // The active message doc tells us whether more segments may still arrive.
  const activeMessage = useQuery(
    api.messages.get,
    activeMessageId ? { messageId: activeMessageId } : "skip",
  );
  activeMessageStatusRef.current = activeMessage?.status ?? null;

  // Resume when the segment we were waiting for becomes ready, or finish if
  // the message is done and no further segments are coming.
  useEffect(() => {
    const waitingFor = waitingForIndexRef.current;
    if (waitingFor === null) return;
    const segment = segments[waitingFor];
    if (segment?.url) {
      const offset = pendingSeekRef.current ?? 0;
      pendingSeekRef.current = null;
      playSegmentAt(waitingFor, offset);
      return;
    }
    // A failed segment shouldn't stall the rest of the chapter — skip it.
    if (segment?.status === "error" && waitingFor + 1 < segments.length) {
      pendingSeekRef.current = null;
      playSegmentAt(waitingFor + 1);
      return;
    }
    const generationDone =
      activeMessage && activeMessage.status !== "streaming" && activeMessage.status !== "pending";
    const noMoreSegments =
      waitingFor >= segments.length ||
      segments[waitingFor]?.status === "error";
    if (generationDone && noMoreSegments) {
      waitingForIndexRef.current = null;
      pendingSeekRef.current = null;
      setBuffering(false);
      setPlaying(false);
    }
    // `buffering` is a dep so this re-evaluates right after `ended` fires,
    // not only when segments/message update.
  }, [segments, activeMessage, buffering, playSegmentAt]);

  const durations = useMemo(() => segments.map(segmentDuration), [segments]);
  const total = useMemo(() => durations.reduce((a, b) => a + b, 0), [durations]);
  const elapsed = useMemo(() => {
    let sum = 0;
    for (let i = 0; i < segIndex && i < durations.length; i++) sum += durations[i];
    return sum + currentTime;
  }, [durations, segIndex, currentTime]);

  const startMessageAt = useCallback(
    (messageId: Id<"messages">, index: number, meta?: PlayerMeta) => {
      unlock();
      metaRef.current = meta ?? metaRef.current;
      setActiveMessageId(messageId);
      setCurrentTime(0);
      segmentsRef.current = messageId === activeMessageId ? segmentsRef.current : [];
      waitingForIndexRef.current = null;
      pendingSeekRef.current = null;
      // Defer one tick so the segments query (if cached) is in segmentsRef.
      setTimeout(() => playSegmentAt(index), 0);
    },
    [activeMessageId, playSegmentAt, unlock],
  );

  const playMessage = useCallback(
    (messageId: Id<"messages">, meta?: PlayerMeta) => {
      if (messageId === activeMessageId) {
        unlock();
        const el = audio();
        // Finished playing through? Pressing play again replays from the top.
        const atEnd =
          el.ended && segIndexRef.current >= segmentsRef.current.length - 1;
        if (!atEnd && el.paused && el.src && waitingForIndexRef.current === null) {
          metaRef.current = meta ?? metaRef.current;
          setPlaying(true);
          void el.play().catch(() => setPlaying(false));
          return;
        }
      }
      startMessageAt(messageId, 0, meta);
    },
    [activeMessageId, startMessageAt, unlock],
  );

  const seekToSegment = useCallback(
    (messageId: Id<"messages">, index: number, meta?: PlayerMeta) => {
      if (messageId === activeMessageId) {
        unlock();
        playSegmentAt(index);
        return;
      }
      startMessageAt(messageId, index, meta);
    },
    [activeMessageId, playSegmentAt, startMessageAt, unlock],
  );

  const pause = useCallback(() => {
    audio().pause();
    setPlaying(false);
    setBuffering(false);
    waitingForIndexRef.current = null;
  }, []);

  const toggle = useCallback(
    (messageId: Id<"messages">, meta?: PlayerMeta) => {
      if (messageId === activeMessageId && (playing || buffering)) {
        pause();
      } else {
        playMessage(messageId, meta);
      }
    },
    [activeMessageId, playing, buffering, pause, playMessage],
  );

  const seekTo = useCallback(
    (seconds: number) => {
      const clamped = Math.max(0, Math.min(seconds, Math.max(0, total - 0.2)));
      let acc = 0;
      for (let i = 0; i < segmentsRef.current.length; i++) {
        const d = durations[i] ?? 0;
        if (clamped < acc + d || i === segmentsRef.current.length - 1) {
          playSegmentAt(i, clamped - acc);
          return;
        }
        acc += d;
      }
    },
    [durations, total, playSegmentAt],
  );

  const skip = useCallback(
    (delta: number) => seekTo(elapsed + delta),
    [seekTo, elapsed],
  );

  const setRate = useCallback((value: number) => {
    setRateState(value);
    audio().playbackRate = value;
  }, []);

  const resync = useCallback(() => {
    const fix = () => {
      const el = audio();
      if (playingRef.current) {
        if (el.paused && !el.ended && el.src && waitingForIndexRef.current === null) {
          void el.play().catch(() => {});
        }
      } else if (!el.paused) {
        el.pause();
      }
    };
    // The audio-session change can land after the toggle settles — retry.
    fix();
    window.setTimeout(fix, 400);
    window.setTimeout(fix, 1200);
  }, []);

  // Lock-screen / hardware controls.
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: metaRef.current.title ?? "ClaudePod",
      artist: "Claude",
      album: "ClaudePod",
    });
    navigator.mediaSession.setActionHandler("play", () => {
      if (activeMessageId) playMessage(activeMessageId);
    });
    navigator.mediaSession.setActionHandler("pause", pause);
    navigator.mediaSession.setActionHandler("seekbackward", () => skip(-15));
    navigator.mediaSession.setActionHandler("seekforward", () => skip(30));
  }, [activeMessageId, playMessage, pause, skip]);

  const api_: PlayerApi = {
    activeMessageId,
    activeSegmentIndex: segIndex,
    playing,
    buffering,
    elapsed,
    total,
    rate,
    segments,
    playMessage,
    toggle,
    seekToSegment,
    pause,
    seekTo,
    skip,
    setRate,
    unlock,
    resync,
  };

  return <PlayerContext.Provider value={api_}>{children}</PlayerContext.Provider>;
}
