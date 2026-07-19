"use client";
import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function sendLink(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
    });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <div className="auth-wrap">
      <div className="eyebrow">ASCM · CSCP</div>
      <h1>The Route</h1>
      <p>Sign in to sync your study progress across every device.</p>
      {sent ? (
        <p className="auth-note">Check <strong>{email}</strong> for a sign-in link.</p>
      ) : (
        <form className="auth-form" onSubmit={sendLink}>
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button type="submit" disabled={busy}>{busy ? "Sending…" : "Send sign-in link"}</button>
          {error && <div className="auth-note" style={{ color: "var(--danger)" }}>{error}</div>}
        </form>
      )}
    </div>
  );
}
