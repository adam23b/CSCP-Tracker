"use client";
import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { MODULES } from "../lib/constants";

const READING_TITLE = "Required Reading";

export default function ExplainModal({ card, userId, onClose }) {
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [question, setQuestion] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const moduleTitle = MODULES.find((m) => m.id === card.module_id)?.title || "";

  async function ask(mode, customQuestion) {
    setLoading(true);
    setErr("");
    setSaved(false);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const res = await fetch("/api/explain-card", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token || ""}` },
        body: JSON.stringify({
          front: card.front,
          back: card.back,
          moduleTitle,
          functionalArea: card.functional_area || "",
          topic: card.topic || "",
          mode,
          question: customQuestion || "",
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setErr(payload?.error || "Something went wrong.");
        return;
      }
      setText(payload.explanation || "");
    } catch {
      setErr("Couldn't reach Claude. Check your connection.");
    } finally {
      setLoading(false);
    }
  }

  async function addToReading() {
    if (!text.trim()) return;
    setSaving(true);
    try {
      const block = `## ${card.topic || card.front}\nQ: ${card.front}\nA: ${card.back}\n\n${text.trim()}`;
      const { data: existing } = await supabase
        .from("notes")
        .select("*")
        .eq("user_id", userId)
        .eq("module_id", card.module_id)
        .eq("title", READING_TITLE)
        .limit(1)
        .maybeSingle();

      if (existing) {
        const content = (existing.content ? existing.content + "\n\n---\n\n" : "") + block;
        await supabase
          .from("notes")
          .update({ content, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
      } else {
        await supabase.from("notes").insert({
          user_id: userId,
          module_id: card.module_id,
          title: READING_TITLE,
          content: block,
          image_paths: [],
        });
      }
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="ex-overlay" onClick={onClose}>
      <div className="ex-box" onClick={(e) => e.stopPropagation()}>
        <div className="ex-head">
          <div className="ex-title">Ask Claude about this card</div>
          <button className="ghost small" onClick={onClose}>Close</button>
        </div>

        <div className="ex-card">
          <div className="ex-front">{card.front}</div>
          <div className="ex-back">{card.back}</div>
        </div>

        <div className="ex-actions">
          <button className="ghost small" onClick={() => ask("context")} disabled={loading}>More context</button>
          <button className="ghost small" onClick={() => ask("example")} disabled={loading}>Give an example</button>
          <button className="ghost small" onClick={() => ask("simplify")} disabled={loading}>Explain simply</button>
        </div>
        <div className="ex-ask-row">
          <input
            type="text"
            placeholder="Or ask your own question…"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && question.trim()) ask("custom", question.trim()); }}
          />
          <button className="small" onClick={() => ask("custom", question.trim())} disabled={loading || !question.trim()}>Ask</button>
        </div>

        {err && <div className="gen-error" style={{ marginTop: 12 }}>{err}</div>}

        {loading && <div className="ex-loading">Claude is thinking…</div>}

        {text && !loading && (
          <>
            <div className="ex-answer">{text}</div>
            <div className="row" style={{ marginTop: 12 }}>
              <button onClick={addToReading} disabled={saving || saved}>
                {saved ? "✓ Added to Required Reading" : saving ? "Saving…" : "Add to Required Reading"}
              </button>
            </div>
            {saved && (
              <div className="gen-success" style={{ marginTop: 8 }}>
                Saved to your <strong>{READING_TITLE}</strong> note for M{card.module_id}.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
