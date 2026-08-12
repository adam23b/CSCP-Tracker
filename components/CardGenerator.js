"use client";
import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { MODULES, dayStr } from "../lib/constants";

const PRIORITY_LABEL = { high: "High-yield", medium: "Medium", low: "Low" };

export default function CardGenerator({ session }) {
  const userId = session.user.id;

  const [notes, setNotes] = useState("");
  const [moduleId, setModuleId] = useState("1");
  const [functionalArea, setFunctionalArea] = useState("");
  const [autoDetected, setAutoDetected] = useState(false);

  const areasFor = (id) => MODULES.find((m) => m.id === parseInt(id))?.areas || [];
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  // candidates: [{ front, back, topic, exam_priority, priority_reason, keep }]
  const [candidates, setCandidates] = useState(null); // null = nothing generated yet
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

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
        body: JSON.stringify({ notes }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload?.error || "Something went wrong. Try again.");
        return;
      }
      if (payload.moduleId) {
        setModuleId(String(payload.moduleId));
        setAutoDetected(true);
      }
      const detectedAreas = areasFor(payload.moduleId || moduleId);
      setFunctionalArea(payload.functionalArea || detectedAreas[0] || "");
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
    setCandidates((cs) => [
      ...(cs || []),
      { front: "", back: "", topic: "", exam_priority: "medium", priority_reason: "", keep: true },
    ]);
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
        functional_area: functionalArea || null,
        front: c.front.trim(),
        back: c.back.trim(),
        topic: c.topic.trim() || null,
        exam_priority: c.exam_priority || null,
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
      setAutoDetected(false);
      setFunctionalArea("");
    } finally {
      setSaving(false);
    }
  }

  const keepableCount = (candidates || []).filter((c) => c.keep).length;
  const moduleTitle = (id) => MODULES.find((m) => m.id === parseInt(id))?.title.split(",")[0] || "";

  return (
    <div className="cols">
      <div className="card">
        <h2>Generate flashcards</h2>
        <div className="note-form">
          <div className="eyebrow" style={{ marginBottom: -2 }}>Paste a section of notes or an ASCM lesson</div>
          <textarea
            placeholder="Paste study notes or lesson content here — a module section, definitions, worked examples… The module and topics are detected automatically."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ minHeight: 240 }}
          />
          <div className="gen-hint">
            Claude writes exam-focused, retention-oriented Q&amp;A cards, auto-tags each with a topic,
            and flags how likely each is to be tested. You review and edit before anything is saved.
            Generation takes ~20–30 seconds (it checks the web to weight exam priority).
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
        ) : (
          <>
            <div className="gen-module-row">
              <label className="gen-field-label" style={{ margin: 0 }}>
                Module {autoDetected && <span className="gen-auto">auto-detected</span>}
              </label>
              <select
                value={moduleId}
                onChange={(e) => {
                  const next = e.target.value;
                  setModuleId(next);
                  setAutoDetected(false);
                  setFunctionalArea(areasFor(next)[0] || "");
                }}
              >
                {MODULES.map((m) => (
                  <option key={m.id} value={m.id}>M{m.id} — {m.title.split(",")[0]}</option>
                ))}
              </select>
            </div>
            <div className="gen-module-row">
              <label className="gen-field-label" style={{ margin: 0 }}>Functional area</label>
              <select value={functionalArea} onChange={(e) => setFunctionalArea(e.target.value)}>
                {!areasFor(moduleId).includes(functionalArea) && functionalArea && (
                  <option value={functionalArea}>{functionalArea}</option>
                )}
                {areasFor(moduleId).map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>

            {candidates.length === 0 ? (
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
                      <div className="gen-head-right">
                        <span
                          className={`gen-prio gen-prio-${c.exam_priority}`}
                          title={c.priority_reason || ""}
                        >
                          {PRIORITY_LABEL[c.exam_priority] || c.exam_priority}
                        </span>
                        <button className="danger small" onClick={() => removeCard(i)}>Remove</button>
                      </div>
                    </div>

                    <div className="gen-meta-row">
                      <input
                        className="gen-topic"
                        value={c.topic}
                        placeholder="Topic"
                        onChange={(e) => updateCard(i, "topic", e.target.value)}
                      />
                      <select
                        className="gen-prio-select"
                        value={c.exam_priority}
                        onChange={(e) => updateCard(i, "exam_priority", e.target.value)}
                      >
                        <option value="high">High-yield</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
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
                    {c.priority_reason && (
                      <div className="gen-reason">Why this priority: {c.priority_reason}</div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="row" style={{ marginTop: 14 }}>
              <button onClick={createCards} disabled={saving || keptCards.length === 0}>
                {saving ? "Saving…" : `Create ${keptCards.length} card${keptCards.length === 1 ? "" : "s"}`}
              </button>
              <button className="ghost" onClick={addBlankCard}>Add a card</button>
            </div>
            <div className="gen-hint" style={{ marginTop: 8 }}>
              All kept cards are saved to <strong>M{moduleId} — {moduleTitle(moduleId)}</strong>
              {functionalArea ? <> · <strong>{functionalArea}</strong></> : ""}.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
