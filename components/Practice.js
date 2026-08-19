"use client";
import { useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";
import { MODULES } from "../lib/constants";

export default function Practice({ session }) {
  const userId = session.user.id;
  const [moduleId, setModuleId] = useState(1);
  const [area, setArea] = useState(""); // "" = whole module
  const [count, setCount] = useState(8);

  const [phase, setPhase] = useState("setup"); // setup | loading | quiz | done
  const [error, setError] = useState("");
  const [questions, setQuestions] = useState([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState([]); // chosen index per question
  const [startedAt, setStartedAt] = useState(0);

  const [savedScore, setSavedScore] = useState(false);
  const [savingScore, setSavingScore] = useState(false);

  const areas = MODULES.find((m) => m.id === moduleId)?.areas || [];

  async function start() {
    setError("");
    setPhase("loading");
    try {
      // Ground the quiz in the user's own cards for this scope, when available.
      let q = supabase.from("cards").select("front,back").eq("user_id", userId).eq("module_id", moduleId);
      if (area) q = q.eq("functional_area", area);
      const { data: cardData } = await q.limit(40);

      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const res = await fetch("/api/generate-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token || ""}` },
        body: JSON.stringify({ moduleId, functionalArea: area, count, cards: cardData || [] }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload?.error || "Something went wrong.");
        setPhase("setup");
        return;
      }
      setQuestions(payload.questions || []);
      setAnswers(new Array((payload.questions || []).length).fill(null));
      setIdx(0);
      setStartedAt(Date.now());
      setSavedScore(false);
      setPhase("quiz");
    } catch {
      setError("Couldn't reach the quiz generator. Check your connection.");
      setPhase("setup");
    }
  }

  function choose(optIdx) {
    if (answers[idx] !== null) return; // already answered
    setAnswers((a) => a.map((v, i) => (i === idx ? optIdx : v)));
  }

  const correctCount = answers.filter((a, i) => a !== null && questions[i] && a === questions[i].correct_index).length;
  const scorePct = questions.length ? Math.round((correctCount / questions.length) * 100) : 0;

  async function saveAsQuizScore() {
    if (!area) return;
    setSavingScore(true);
    try {
      await supabase.from("quiz_scores").upsert(
        { user_id: userId, module_id: moduleId, functional_area: area, score: scorePct, updated_at: new Date().toISOString() },
        { onConflict: "user_id,module_id,functional_area" },
      );
      setSavedScore(true);
    } finally {
      setSavingScore(false);
    }
  }

  function reset() {
    setPhase("setup");
    setQuestions([]);
    setAnswers([]);
    setIdx(0);
  }

  // --- Setup ---
  if (phase === "setup" || phase === "loading") {
    return (
      <div className="card" style={{ maxWidth: 640, margin: "0 auto" }}>
        <h2>Practice questions</h2>
        <p className="gen-hint" style={{ margin: "4px 0 12px" }}>
          Timed-style, scenario-based multiple-choice questions like the real CSCP exam, grounded in your
          own flashcards for the area when you have them. Score an area to feed your
          <Link href="/readiness" className="today-link"> readiness</Link>.
        </p>
        <div className="note-form">
          <select value={moduleId} onChange={(e) => { setModuleId(parseInt(e.target.value)); setArea(""); }}>
            {MODULES.map((m) => <option key={m.id} value={m.id}>M{m.id} — {m.title.split(",")[0]}</option>)}
          </select>
          <select value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="">Whole module (mixed areas)</option>
            {areas.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={count} onChange={(e) => setCount(parseInt(e.target.value))}>
            <option value={5}>5 questions</option>
            <option value={8}>8 questions</option>
            <option value={10}>10 questions</option>
          </select>
          <div className="row">
            <button onClick={start} disabled={phase === "loading"}>
              {phase === "loading" ? "Building your quiz…" : "Start practice"}
            </button>
          </div>
          {phase === "loading" && <div className="gen-hint">Writing {count} exam-style questions — about 30–60 seconds.</div>}
          {error && <div className="gen-error">{error}</div>}
        </div>
      </div>
    );
  }

  // --- Done ---
  if (phase === "done") {
    return (
      <div className="card" style={{ maxWidth: 720, margin: "0 auto" }}>
        <h2>Results</h2>
        <div className="pr-score">
          <span className="pr-score-num">{scorePct}%</span>
          <span className="pr-score-sub">{correctCount} / {questions.length} correct</span>
        </div>
        {area ? (
          savedScore ? (
            <div className="gen-success">Saved {scorePct}% as your quiz score for {area}. It now feeds your readiness.</div>
          ) : (
            <div className="row">
              <button onClick={saveAsQuizScore} disabled={savingScore}>
                {savingScore ? "Saving…" : `Save ${scorePct}% as quiz score for ${area}`}
              </button>
            </div>
          )
        ) : (
          <p className="gen-hint">Pick a single functional area (not the whole module) if you want to save a score to your readiness.</p>
        )}

        <div className="pr-review">
          {questions.map((q, i) => {
            const chosen = answers[i];
            const right = chosen === q.correct_index;
            return (
              <div className="pr-rev" key={i}>
                <div className="pr-rev-q"><span className={right ? "pr-ok" : "pr-no"}>{right ? "✓" : "✗"}</span> {q.scenario}</div>
                <div className="pr-rev-a">Correct: {q.options[q.correct_index]}{chosen !== null && !right && <> · You: {q.options[chosen]}</>}</div>
                <div className="pr-rev-r">{q.rationale}</div>
              </div>
            );
          })}
        </div>
        <div className="row" style={{ marginTop: 14 }}>
          <button onClick={reset}>New practice quiz</button>
        </div>
      </div>
    );
  }

  // --- Quiz ---
  const q = questions[idx];
  const chosen = answers[idx];
  const answered = chosen !== null;
  const last = idx === questions.length - 1;

  return (
    <div className="card" style={{ maxWidth: 720, margin: "0 auto" }}>
      <div className="pr-top">
        <span className="pr-progress">Question {idx + 1} / {questions.length}</span>
        <span className="pr-scope">M{moduleId}{area ? ` · ${area}` : ""}</span>
      </div>
      <div className="pr-scenario">{q.scenario}</div>
      <div className="pr-options">
        {q.options.map((opt, oi) => {
          let cls = "pr-option";
          if (answered) {
            if (oi === q.correct_index) cls += " pr-correct";
            else if (oi === chosen) cls += " pr-wrong";
          }
          return (
            <button key={oi} className={cls} onClick={() => choose(oi)} disabled={answered}>
              <span className="pr-opt-letter">{String.fromCharCode(65 + oi)}</span>
              {opt}
            </button>
          );
        })}
      </div>
      {answered && (
        <div className="pr-rationale">
          <strong>{chosen === q.correct_index ? "Correct." : "Not quite."}</strong> {q.rationale}
        </div>
      )}
      <div className="row" style={{ marginTop: 14, justifyContent: "flex-end" }}>
        {answered && (
          last
            ? <button onClick={() => setPhase("done")}>See results</button>
            : <button onClick={() => setIdx((i) => i + 1)}>Next question</button>
        )}
      </div>
    </div>
  );
}
