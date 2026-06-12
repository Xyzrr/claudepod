import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider, Outlet } from "react-router-dom";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient, Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { PlayerProvider } from "./lib/player";
import SignIn from "./routes/SignIn";
import Library from "./routes/Library";
import Conversation from "./routes/Conversation";
import Settings from "./routes/Settings";
import { pinAudioSessionForMicPlayback } from "./lib/audioSession";
import "./styles.css";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

// iOS flips the audio session between "playback" and "play-and-record" as mic
// capture starts/stops, which changes output loudness dramatically (and moves
// volume control to the separate call-volume slider). Pinning the session type
// keeps loudness consistent across mic toggles. Safari 17+; no-op elsewhere.
pinAudioSessionForMicPlayback();

function Root() {
  return (
    <>
      <AuthLoading>
        <div className="splash">
          <div className="splash-logo">ClaudePod</div>
        </div>
      </AuthLoading>
      <Unauthenticated>
        <SignIn />
      </Unauthenticated>
      <Authenticated>
        <PlayerProvider>
          <Outlet />
        </PlayerProvider>
      </Authenticated>
    </>
  );
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <Root />,
    children: [
      { index: true, element: <Library /> },
      { path: "c/:conversationId", element: <Conversation /> },
      { path: "settings", element: <Settings /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConvexAuthProvider client={convex}>
      <RouterProvider router={router} />
    </ConvexAuthProvider>
  </React.StrictMode>,
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
