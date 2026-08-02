"use client";
import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { MODULES, dayStr } from "../lib/constants";

export default function CardGenerator({ session }) {
  const userId = session.user.id;

  const [notes, setNotes] = useState("");
  const [moduleId, setModuleId] = useState("1");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  // candidates: [{ front, back, keep }]
  const [candidates, setCandidates] = useState(null); // null = nothing generated yet
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  const moduleTitle = (id) => MODULES.find((m) => m.id === parseInt(id))?.title || "";

  async function generate() {
    if (notes.trim().length < 20) {
      setError("Paste a bit more text to generate cards from.");
      return;
    }
    setError("");
    setSavedCount(0);
    setGenerating(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const res = await fetch("/api/generate-cards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token || ""}`,
        },
        body: JSON.stringify({ notes, moduleTitle: moduleTitle(moduleId) }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload?.error || "Something went wrong. Try again.");
        return;
      }
      setCandidates((payload.cards || []).map((c) => ({ ...c, keep: true })));
    } catch {
      setError("Couldn't reach the generator. Check your connection and try again.");
    } finally {
      setGenerating(false);
    }
  }

  function updateCard(idx, field, value) {
    setCandidates((cs) => cs.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));
  }
  function toggleKeep(idx) {
    setCandidates((cs) => cs.map((c, i) => (i === idx ? { ...c, keep: !c.keep } : c)));
  }
  function removeCard(idx) {
    setCandidates((cs) => cs.filter((_, i) => i !== idx));
  }
  function addBlankCard() {
    setCandidates((cs) => [...(cs || []), { front: "", back: "", keep: true }]);
  }

  const keptCards = (candidates || []).filter(
    (c) => c.keep && c.front.trim() && c.back.trim(),
  );

  async function createCards() {
    if (keptCards.length === 0) return;
    setSaving(true);
    setError("");
    try {
      const today = dayStr(new Date());
      const rows = keptCards.map((c) => ({
        user_id: userId,
        module_id: parseInt(moduleId),
        front: c.front.trim(),
        back: c.back.trim(),
        step: 0,
        due_date: today,
        image_path: null,
      }));
      const { error: insertError } = await supabase.from("cards").insert(rows);
      if (insertError) {
        setError("Couldn't save the cards. Try again.");
        return;
      }
      setSavedCount(rows.length);
      setCandidates(null);
      setNotes("");
    } finally {
      setSaving(false);
    }
  }

  const keepableCount = (candidates || []).filter((c) => c.keep).length;

  return (
    <div className="cols">
      <div className="card">
        <h2>Generate flashcards</h2>
        <div className="note-form">
          <div className="eyebrow" style={{ marginBottom: -2 }}>Paste a section of notes</div>
          <select value={moduleId} onChange={(e) => setModuleId(e.target.value)}>
            {MODULES.map((m) => (
              <option key={m.id} value={m.id}>M{m.id} — {m.title.split(",")[0]}</option>
            ))}
          </select>
          <textarea
            placeholder="Paste study notes here — a section from a module, a page of definitions, worked examples…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ minHeight: 220 }}
          />
          <div className="gen-hint">
            Claude turns these into exam-focused Q&amp;A cards for M{moduleId} — {moduleTitle(moduleId).split(",")[0]}.
            You review and edit before anything is saved.
          </div>
          <div className="row">
            <button onClick={generate} disabled={generating}>
              {generating ? "Generating…" : "Generate flashcards"}
            </button>
          </div>
          {error && <div className="gen-error">{error}</div>}
          {savedCount > 0 && (
            <div className="gen-success">
              ✓ Added {savedCount} card{savedCount === 1 ? "" : "s"} to the deck — they're due today in the Dock.
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h2>
          Review
          {candidates && candidates.length > 0 && (
            <span className="count">{keepableCount} of {candidates.length} kept</span>
          )}
        </h2>

        {candidates === null ? (
          <div className="empty">
            {generating ? "Generating cards…" : "Generated cards will appear here for review."}
          </div>
        ) : candidates.length === 0 ? (
          <div className="empty">No cards. Add one below or generate again.</div>
        ) : (
          <div className="gen-list">
            {candidates.map((c, i) => (
              <div className={`gen-card ${c.keep ? "" : "gen-card-off"}`} key={i}>
                <div className="gen-card-head">
                  <label className="gen-keep">
                    <input type="checkbox" checked={c.keep} onChange={() => toggleKeep(i)} />
                    Keep
                  </label>
                  <button className="danger small" onClick={() => removeCard(i)}>Remove</button>
                </div>
                <label className="gen-field-label">Front</label>
                <textarea
                  className="gen-field"
                  value={c.front}
                  onChange={(e) => updateCard(i, "front", e.target.value)}
                  placeholder="Question / prompt"
                />
                <label className="gen-field-label">Back</label>
                <textarea
                  className="gen-field"
                  value={c.back}
                  onChange={(e) => updateCard(i, "back", e.target.value)}
                  placeholder="Answer"
                />
              </div>
            ))}
          </div>
        )}

        {candidates !== null && (
          <div className="row" style={{ marginTop: 14 }}>
            <button onClick={createCards} disabled={saving || keptCards.length === 0}>
              {saving ? "Saving…" : `Create ${keptCards.length} card${keptCards.length === 1 ? "" : "s"}`}
            </button>
            <button className="ghost" onClick={addBlankCard}>Add a card</button>
          </div>
        )}
      </div>
    </div>
  );
}
