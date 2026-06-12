import { useState, type FormEvent, type ReactNode } from "react";
import type { MicState } from "../lib/useMic";
import { IconMic, IconSend } from "./icons";

/**
 * Bottom dock: now-playing bar (slot), live transcription + "sending in…"
 * countdown, the big thumb-reachable mic toggle, and an always-available
 * text composer.
 */
export default function MicDock({
  micEnabled,
  setMicEnabled,
  mic,
  isPlaying,
  onSubmitText,
  disabled,
  nowPlaying,
}: {
  micEnabled: boolean;
  setMicEnabled: (on: boolean) => void;
  mic: MicState;
  isPlaying: boolean;
  onSubmitText: (text: string) => void;
  disabled: boolean;
  nowPlaying?: ReactNode;
}) {
  const [text, setText] = useState("");

  const heard = [mic.draft, mic.interim].filter(Boolean).join(" ");
  const showVoicePanel = micEnabled && (heard || mic.status !== "listening" || isPlaying);

  function submit(event: FormEvent) {
    event.preventDefault();
    const value = text.trim();
    if (!value || disabled) return;
    setText("");
    onSubmitText(value);
  }

  return (
    <div className="dock">
      {nowPlaying}
      {showVoicePanel && (
        <div className="voice-panel">
          {mic.status === "connecting" && <p className="voice-hint">Connecting microphone…</p>}
          {mic.status === "error" && (
            <p className="form-error">Mic error: {mic.error ?? "unknown"}</p>
          )}
          {mic.status === "listening" && isPlaying && (
            <p className="voice-hint">
              Playing — say <strong>“stop”</strong> to pause. Everything else is ignored.
            </p>
          )}
          {mic.status === "listening" && !isPlaying && !heard && (
            <p className="voice-hint">Listening — just start talking.</p>
          )}
          {heard && !isPlaying && (
            <>
              <p className="voice-transcript">
                {mic.draft}
                {mic.interim && <em> {mic.interim}</em>}
              </p>
              {mic.countdownMs !== null && (
                <div className="voice-countdown">
                  <span>Sending in {Math.ceil(mic.countdownMs / 1000)}s…</span>
                  <button className="btn-chip" onClick={mic.cancelDraft}>
                    Cancel
                  </button>
                  <button
                    className="btn-chip"
                    onClick={() => {
                      setText(mic.takeDraft());
                    }}
                  >
                    Edit
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className="dock-row">
        <form className="composer" onSubmit={submit}>
          <input
            type="text"
            value={text}
            placeholder={micEnabled ? "Type instead…" : "Ask anything…"}
            onChange={(e) => setText(e.target.value)}
            enterKeyHint="send"
          />
          <button
            type="submit"
            className="btn-primary composer-send"
            disabled={disabled || !text.trim()}
            aria-label="Send"
          >
            <IconSend size={18} />
          </button>
        </form>
        <button
          className={`mic-btn ${micEnabled ? "on" : ""} ${
            mic.status === "listening" ? "live" : ""
          }`}
          aria-label={micEnabled ? "Turn microphone off" : "Turn microphone on"}
          aria-pressed={micEnabled}
          onClick={() => setMicEnabled(!micEnabled)}
        >
          <IconMic size={24} />
          <span className="mic-state">{micEnabled ? "On" : "Off"}</span>
        </button>
      </div>
    </div>
  );
}
