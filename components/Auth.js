"use client";
import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState("email"); // 'email' | 'code'
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function sendCode(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({ email });
    setBusy(false);
    if (error) setError(error.message);
    else setStage("code");
  }

  async function verifyCode(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: "email",
    });
    setBusy(false);
    if (error) setError("That code didn't work — check it and try again, or request a new one.");
    // On success, onAuthStateChange in useSession picks it up automatically.
  }

  return (
    <div className="auth-wrap">
      <div className="eyebrow">ASCM · CSCP</div>
      <h1>The Route</h1>
      {stage === "email" ? (
        <>
          <p>Sign in to sync your study progress across every device.</p>
          <form className="auth-form" onSubmit={sendCode}>
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button type="submit" disabled={busy}>{busy ? "Sending…" : "Email me a code"}</button>
            {error && <div className="auth-note" style={{ color: "var(--danger)" }}>{error}</div>}
          </form>
        </>
      ) : (
        <>
          <p>Enter the 6-digit code sent to <strong>{email}</strong>.</p>
          <form className="auth-form" onSubmit={verifyCode}>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              placeholder="123456"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              style={{ textAlign: "center", fontSize: 20, letterSpacing: "0.35em", fontFamily: "'JetBrains Mono', monospace" }}
            />
            <button type="submit" disabled={busy || code.trim().length < 6}>
              {busy ? "Checking…" : "Sign in"}
            </button>
            {error && <div className="auth-note" style={{ color: "var(--danger)" }}>{error}</div>}
            <button type="button" className="ghost" onClick={() => { setStage("email"); setCode(""); setError(""); }}>
              Use a different email
            </button>
          </form>
        </>
      )}
    </div>
  );
}
