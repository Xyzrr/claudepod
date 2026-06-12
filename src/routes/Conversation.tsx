import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { usePlayer } from "../lib/player";
import { useMic } from "../lib/useMic";
import AssistantMessage from "../components/AssistantMessage";
import NowPlayingBar from "../components/NowPlayingBar";
import MicDock from "../components/MicDock";

export default function Conversation() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const id = conversationId as Id<"conversations">;

  const conversation = useQuery(api.conversations.get, { conversationId: id });
  const messages = useQuery(api.messages.list, { conversationId: id }) ?? [];
  const settings = useQuery(api.settings.get);
  const send = useMutation(api.messages.send);
  const player = usePlayer();

  const [micEnabled, setMicEnabled] = useState(false);

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const generating =
    lastAssistant?.status === "pending" || lastAssistant?.status === "streaming";

  // Which message in THIS conversation is currently sounding.
  const isPlayingHere =
    player.activeMessageId !== null &&
    (player.playing || player.buffering) &&
    messages.some((m) => m._id === player.activeMessageId);

  function submit(text: string) {
    player.unlock(); // any submit is a user gesture → unlock audio for autoplay
    void send({ conversationId: id, content: text });
  }

  const mic = useMic({
    enabled: micEnabled,
    isPlaying: isPlayingHere,
    silenceMs: settings?.silenceMs ?? 2750,
    onSubmit: submit,
    onStopCommand: player.pause,
  });

  // Auto-play a fresh answer once its first audio segment is ready.
  const autoPlayedRef = useRef<Id<"messages"> | null>(null);
  useEffect(() => {
    if (!settings?.autoPlay || !lastAssistant) return;
    if (autoPlayedRef.current === lastAssistant._id) return;
    // Only auto-play answers born in this session (not on first page load).
    if (lastAssistant.status !== "streaming" && lastAssistant.status !== "pending") return;
    autoPlayedRef.current = lastAssistant._id;
    player.playMessage(lastAssistant._id, { title: conversation?.title });
  }, [lastAssistant, settings?.autoPlay, player, conversation?.title]);

  // Apply the user's default playback speed once.
  const appliedRateRef = useRef(false);
  useEffect(() => {
    if (settings && !appliedRateRef.current) {
      appliedRateRef.current = true;
      player.setRate(settings.playbackRate);
    }
  }, [settings, player]);

  // Keep the newest content in view.
  const endRef = useRef<HTMLDivElement>(null);
  const messageCount = messages.length;
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messageCount]);

  if (conversation === null) {
    return (
      <div className="app">
        <main className="empty">
          <p className="empty-title">Conversation not found.</p>
          <Link to="/">Back to library</Link>
        </main>
      </div>
    );
  }

  let chapterNumber = 0;
  const assistantMessages = messages.filter((m) => m.role === "assistant");
  const activeChapterIndex = assistantMessages.findIndex(
    (m) => m._id === player.activeMessageId,
  );
  const activeChapterNumber = activeChapterIndex === -1 ? null : activeChapterIndex + 1;

  return (
    <div className="app app-conversation">
      <header className="header">
        <Link className="icon-btn" to="/" aria-label="Library">
          ←
        </Link>
        <h1 className="header-title" title={conversation?.title}>
          {conversation?.title ?? "…"}
        </h1>
        <Link className="icon-btn" to="/settings" aria-label="Settings">
          ⚙︎
        </Link>
      </header>

      <main className="thread">
        {messages.length === 0 && (
          <div className="empty">
            <p className="empty-title">Ask away.</p>
            <p className="empty-sub">
              Turn the mic on and talk, or type below. Answers play like podcast
              chapters — say “stop” any time to pause.
            </p>
          </div>
        )}
        {messages.map((message) => {
          if (message.role === "user") {
            return (
              <div key={message._id} className="user-msg">
                {message.content}
              </div>
            );
          }
          chapterNumber += 1;
          return (
            <AssistantMessage
              key={message._id}
              message={message}
              chapterNumber={chapterNumber}
              conversationTitle={conversation?.title ?? "ClaudePod"}
            />
          );
        })}
        <div ref={endRef} />
      </main>

      <MicDock
        nowPlaying={
          <NowPlayingBar
            label={
              activeChapterNumber !== null ? `Chapter ${activeChapterNumber}` : null
            }
          />
        }
        micEnabled={micEnabled}
        setMicEnabled={(on) => {
          player.unlock(); // mic toggle is the natural first gesture
          setMicEnabled(on);
        }}
        mic={mic}
        isPlaying={isPlayingHere}
        onSubmitText={submit}
        disabled={generating}
      />
    </div>
  );
}
