import { useCallback, useEffect, useRef, useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { STOP_COMMAND_REGEX } from "../../convex/appConfig";

/**
 * Microphone + Deepgram live transcription with two modes:
 *
 * - While Claude's audio is PLAYING: we keep listening but the only thing we
 *   act on is a loose "stop" command ("stop", "okay stop", "claude stop").
 *   Gym chatter, music and grunting are ignored.
 * - While playback is stopped: speech accumulates into a draft prompt that is
 *   submitted only after `silenceMs` of quiet, with a visible, cancellable
 *   countdown.
 *
 * The browser talks to Deepgram directly over a WebSocket authorized by a
 * short-lived token minted server-side (convex/stt.ts).
 */

export type MicStatus = "off" | "connecting" | "listening" | "error";

type UseMicArgs = {
  enabled: boolean;
  isPlaying: boolean;
  silenceMs: number;
  onSubmit: (text: string) => void;
  onStopCommand: () => void;
  /**
   * Fired when mic capture actually starts or stops. The OS may pause/resume
   * other audio when the capture session changes; callers use this to
   * re-assert playback state (player.resync).
   */
  onCaptureChange?: () => void;
};

export type MicState = {
  status: MicStatus;
  error: string | null;
  /** Words still being recognized (low confidence, live). */
  interim: string;
  /** Finalized transcript waiting to be sent. */
  draft: string;
  /** ms until auto-submit, or null when not counting down. */
  countdownMs: number | null;
  cancelDraft: () => void;
  /** Take the draft out of voice flow (e.g. to edit it in the composer). */
  takeDraft: () => string;
};

const DG_URL =
  "wss://api.deepgram.com/v1/listen?" +
  new URLSearchParams({
    model: "nova-3",
    language: "en",
    smart_format: "true",
    interim_results: "true",
    punctuate: "true",
  }).toString();

export function useMic({
  enabled,
  isPlaying,
  silenceMs,
  onSubmit,
  onStopCommand,
  onCaptureChange,
}: UseMicArgs): MicState {
  const getToken = useAction(api.stt.getDeepgramToken);

  const [status, setStatus] = useState<MicStatus>("off");
  const [error, setError] = useState<string | null>(null);
  const [interim, setInterim] = useState("");
  const [draft, setDraft] = useState("");
  const [countdownMs, setCountdownMs] = useState<number | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const draftRef = useRef("");
  const lastSpeechAtRef = useRef(0);
  const silenceMsRef = useRef(silenceMs);
  silenceMsRef.current = silenceMs;
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;
  const onStopCommandRef = useRef(onStopCommand);
  onStopCommandRef.current = onStopCommand;
  const onCaptureChangeRef = useRef(onCaptureChange);
  onCaptureChangeRef.current = onCaptureChange;
  const generationRef = useRef(0);
  const interimClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetBuffers = useCallback(() => {
    if (interimClearTimerRef.current) {
      clearTimeout(interimClearTimerRef.current);
      interimClearTimerRef.current = null;
    }
    draftRef.current = "";
    setDraft("");
    setInterim("");
    setCountdownMs(null);
  }, []);

  const cancelDraft = useCallback(() => {
    resetBuffers();
  }, [resetBuffers]);

  const takeDraft = useCallback(() => {
    const text = [draftRef.current, ""].join("").trim();
    resetBuffers();
    return text;
  }, [resetBuffers]);

  const handleTranscript = useCallback((transcript: string, isFinal: boolean) => {
    const text = transcript.trim();
    if (!text) return;
    if (interimClearTimerRef.current) {
      clearTimeout(interimClearTimerRef.current);
      interimClearTimerRef.current = null;
    }

    if (isPlayingRef.current) {
      // Playback in progress: "stop" is the ONLY recognized command, but
      // everything heard is shown live so the user can see why a mangled
      // "stop" didn't take. Nothing here ever reaches the draft.
      if (STOP_COMMAND_REGEX.test(text)) {
        onStopCommandRef.current();
        draftRef.current = "";
        setDraft("");
        setInterim("");
        return;
      }
      setInterim(text);
      if (isFinal) {
        interimClearTimerRef.current = setTimeout(() => setInterim(""), 2000);
      }
      return;
    }

    lastSpeechAtRef.current = Date.now();
    if (isFinal) {
      draftRef.current = (draftRef.current + " " + text).trim();
      setDraft(draftRef.current);
      setInterim("");
    } else {
      setInterim(text);
    }
  }, []);

  // Connect / disconnect with the mic toggle.
  useEffect(() => {
    if (!enabled) {
      generationRef.current++;
      recorderRef.current?.stop();
      recorderRef.current = null;
      wsRef.current?.close();
      wsRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      resetBuffers();
      setStatus("off");
      setError(null);
      onCaptureChangeRef.current?.();
      return;
    }

    const generation = ++generationRef.current;
    let keepAlive: ReturnType<typeof setInterval> | null = null;

    async function connect() {
      try {
        setStatus("connecting");
        setError(null);
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error(
            window.isSecureContext
              ? "This browser doesn't support microphone capture."
              : "Microphone needs HTTPS — open the app via an https:// URL (browsers block mic access on plain http).",
          );
        }
        if (!streamRef.current) {
          streamRef.current = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
          onCaptureChangeRef.current?.();
        }
        if (generationRef.current !== generation) {
          // Mic was toggled off while getUserMedia was in flight — the
          // cleanup branch found nothing to stop, so stop the stream here.
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
          onCaptureChangeRef.current?.();
          return;
        }

        const { accessToken } = await getToken();
        if (generationRef.current !== generation) return;

        const ws = new WebSocket(DG_URL, ["bearer", accessToken]);
        wsRef.current = ws;

        ws.onopen = () => {
          if (generationRef.current !== generation) return ws.close();
          setStatus("listening");
          const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
            ? "audio/webm;codecs=opus"
            : undefined;
          const recorder = new MediaRecorder(
            streamRef.current!,
            mimeType ? { mimeType } : undefined,
          );
          recorderRef.current = recorder;
          recorder.ondataavailable = (event) => {
            if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
              ws.send(event.data);
            }
          };
          recorder.start(250);
          keepAlive = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "KeepAlive" }));
            }
          }, 7000);
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data as string);
            if (message.type !== "Results") return;
            const alternative = message.channel?.alternatives?.[0];
            if (!alternative) return;
            handleTranscript(alternative.transcript ?? "", Boolean(message.is_final));
          } catch {
            // Non-JSON frames are ignored.
          }
        };

        ws.onclose = () => {
          if (keepAlive) clearInterval(keepAlive);
          recorderRef.current?.stop();
          recorderRef.current = null;
          // Tokens are short-lived; transparently reconnect while enabled.
          if (generationRef.current === generation && enabledRef.current) {
            setTimeout(() => {
              if (generationRef.current === generation && enabledRef.current) {
                void connect();
              }
            }, 600);
          }
        };

        ws.onerror = () => {
          // onclose fires next and handles reconnection.
        };
      } catch (err) {
        if (generationRef.current !== generation) return;
        setStatus("error");
        setError(err instanceof Error ? err.message : String(err));
      }
    }

    void connect();
    return () => {
      if (keepAlive) clearInterval(keepAlive);
    };
  }, [enabled, getToken, handleTranscript, resetBuffers]);

  // Silence countdown → auto-submit.
  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => {
      if (isPlayingRef.current) {
        setCountdownMs(null);
        return;
      }
      if (!draftRef.current) {
        setCountdownMs(null);
        return;
      }
      const sinceSpeech = Date.now() - lastSpeechAtRef.current;
      const remaining = silenceMsRef.current - sinceSpeech;
      if (remaining <= 0) {
        const text = draftRef.current;
        draftRef.current = "";
        setDraft("");
        setInterim("");
        setCountdownMs(null);
        if (text.trim()) onSubmitRef.current(text.trim());
      } else {
        setCountdownMs(remaining);
      }
    }, 100);
    return () => clearInterval(timer);
  }, [enabled]);

  return { status, error, interim, draft, countdownMs, cancelDraft, takeDraft };
}
