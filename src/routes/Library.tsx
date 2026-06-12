import { useNavigate, Link } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../convex/_generated/api";
import { formatDate, formatTime } from "../lib/format";

/** The "library": every past session, resumable with its audio intact. */
export default function Library() {
  const conversations = useQuery(api.conversations.list) ?? [];
  const createConversation = useMutation(api.conversations.create);
  const removeConversation = useMutation(api.conversations.remove);
  const { signOut } = useAuthActions();
  const navigate = useNavigate();

  return (
    <div className="app">
      <header className="header">
        <h1 className="brand">ClaudePod</h1>
        <div className="header-actions">
          <Link className="icon-btn" to="/settings" aria-label="Settings">
            ⚙︎
          </Link>
          <button className="icon-btn" onClick={() => void signOut()} aria-label="Sign out">
            ⎋
          </button>
        </div>
      </header>

      <main className="library">
        {conversations.length === 0 && (
          <div className="empty">
            <p className="empty-title">Your library is empty.</p>
            <p className="empty-sub">
              Start a conversation, ask something meaty, and listen to the answer
              like a podcast chapter.
            </p>
          </div>
        )}
        <ul className="library-list">
          {conversations.map((conversation) => (
            <li key={conversation._id}>
              <Link className="library-item" to={`/c/${conversation._id}`}>
                <div className="library-item-main">
                  <span className="library-item-title">{conversation.title}</span>
                  <span className="library-item-meta">
                    {formatDate(conversation.updatedAt)}
                    {conversation.totalDurationSec > 1 && (
                      <> · {formatTime(conversation.totalDurationSec)} of audio</>
                    )}
                  </span>
                </div>
                <button
                  className="icon-btn danger"
                  aria-label="Delete conversation"
                  onClick={(event) => {
                    event.preventDefault();
                    if (confirm(`Delete “${conversation.title}”? Audio is deleted too.`)) {
                      void removeConversation({ conversationId: conversation._id });
                    }
                  }}
                >
                  ✕
                </button>
              </Link>
            </li>
          ))}
        </ul>
      </main>

      <div className="dock dock-library">
        <button
          className="btn-primary btn-big"
          onClick={() => {
            void createConversation().then((id) => navigate(`/c/${id}`));
          }}
        >
          New conversation
        </button>
      </div>
    </div>
  );
}
