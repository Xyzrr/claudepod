import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";

export default function SignIn() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="signin">
      <div className="signin-card">
        <h1 className="brand">ClaudePod</h1>
        <p className="signin-tagline">Ask anything. Listen to the answer.</p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            setBusy(true);
            const formData = new FormData(event.currentTarget);
            formData.set("flow", flow);
            void signIn("password", formData)
              .catch((err) => {
                setError(
                  err instanceof Error && /InvalidSecret|InvalidAccountId/.test(err.message)
                    ? "Wrong email or password."
                    : "Sign in failed. Check your details and try again.",
                );
              })
              .finally(() => setBusy(false));
          }}
        >
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete={flow === "signIn" ? "current-password" : "new-password"}
              minLength={8}
              required
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button className="btn-primary" type="submit" disabled={busy}>
            {busy ? "…" : flow === "signIn" ? "Sign in" : "Create account"}
          </button>
        </form>
        <button
          className="btn-link"
          type="button"
          onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}
        >
          {flow === "signIn"
            ? "First time here? Create an account"
            : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
