"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";
import { MODULES, dayStr } from "../lib/constants";
import { readiness, readinessLabel, blendReadiness, avgOrNull } from "../lib/readiness";

const UNTAGGED = "Untagged";

function Bar({ pct }) {
  const label = readinessLabel(pct);
  return (
    <div className="rd-bar" title="Target 80%">
      <div className={`rd-bar-fill rd-${label.cls}`} style={{ width: `${pct || 0}%` }} />
      <div className="rd-bar-target" />
    </div>
  );
}

function Ring({ pct }) {
  const label = readinessLabel(pct);
  const r = 54;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - (pct || 0) / 100);
  return (
    <svg width="140" height="140" viewBox="0 0 140 140" className={`rd-ring rd-${label.cls}`}>
      <circle cx="70" cy="70" r={r} className="rd-ring-track" />
      <circle cx="70" cy="70" r={r} className="rd-ring-fill" strokeDasharray={c}
        strokeDashoffset={pct === null ? c : offset} transform="rotate(-90 70 70)" />
      <text x="70" y="66" textAnchor="middle" className="rd-ring-num">{pct === null ? "—" : `${pct}%`}</text>
      <text x="70" y="88" textAnchor="middle" className="rd-ring-lbl">{label.text}</text>
    </svg>
  );
}

function Row({ kind, name, pct, count, caret, quiz, onClick }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag className={`rd-row rd-row-${kind}`} onClick={onClick}>
      <div className="rd-row-head">
        {caret !== undefined && <span className="rd-caret">{caret}</span>}
        <span className="rd-name">{name}</span>
        {quiz !== null && quiz !== undefined && <span className="rd-quiz">Q {quiz}%</span>}
        <span className="rd-pct">{pct === null ? "—" : `${pct}%`}</span>
        <span className="rd-count">{count}</span>
      </div>
      <Bar pct={pct} />
    </Tag>
  );
}

export default function Readiness({ session }) {
  const userId = session.user.id;
  const [cards, setCards] = useState(null);
  const [quizRows, setQuizRows] = useState([]);
  const [openModules, setOpenModules] = useState({});
  const [openAreas, setOpenAreas] = useState({});
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const today = dayStr(new Date());

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    const [cardsRes, quizRes] = await Promise.all([
      supabase.from("cards").select("*").eq("user_id", userId),
      supabase.from("quiz_scores").select("*").eq("user_id", userId),
    ]);
    setCards(cardsRes.data || []);
    setQuizRows(quizRes.data || []);
  }

  const quizMap = useMemo(() => {
    const m = {};
    quizRows.forEach((q) => { m[`${q.module_id}::${q.functional_area}`] = Number(q.score); });
    return m;
  }, [quizRows]);

  const quizFor = (mid, area) => {
    const v = quizMap[`${mid}::${area}`];
    return v === undefined ? null : v;
  };

  const byModule = useMemo(() => {
    const map = {};
    MODULES.forEach((m) => (map[m.id] = []));
    (cards || []).forEach((c) => {
      if (!map[c.module_id]) map[c.module_id] = [];
      map[c.module_id].push(c);
    });
    return map;
  }, [cards]);

  function areaGroups(moduleId) {
    const cardsIn = byModule[moduleId] || [];
    const official = MODULES.find((m) => m.id === moduleId)?.areas || [];
    const groups = [];
    official.forEach((area) => {
      const inArea = cardsIn.filter((c) => c.functional_area === area);
      groups.push({ area, cards: inArea }); // include areas with a quiz score but no cards
    });
    const untagged = cardsIn.filter((c) => !c.functional_area || !official.includes(c.functional_area));
    if (untagged.length) groups.push({ area: UNTAGGED, cards: untagged });
    return groups.filter((g) => g.cards.length > 0 || quizFor(moduleId, g.area) !== null);
  }

  function topicGroups(cardsIn) {
    const map = {};
    cardsIn.forEach((c) => {
      const t = (c.topic && c.topic.trim()) || UNTAGGED;
      (map[t] = map[t] || []).push(c);
    });
    return Object.entries(map).map(([topic, cs]) => ({ topic, cards: cs })).sort((a, b) => b.cards.length - a.cards.length);
  }

  // Overall + per-module blended readiness
  const overallFlash = useMemo(() => readiness(cards || [], today).pct, [cards, today]);
  const overallStats = useMemo(() => readiness(cards || [], today), [cards, today]);
  const overallQuiz = useMemo(() => avgOrNull(Object.values(quizMap)), [quizMap]);
  const overallCombined = blendReadiness(overallFlash, overallQuiz);

  function moduleBlend(m) {
    const cardsIn = byModule[m.id] || [];
    const f = readiness(cardsIn, today).pct;
    const q = avgOrNull((m.areas || []).map((a) => quizFor(m.id, a)));
    return { f, q, combined: blendReadiness(f, q), count: cardsIn.length };
  }

  // --- Editor ---
  function startEdit() {
    const d = {};
    MODULES.forEach((m) => m.areas.forEach((a) => {
      const v = quizFor(m.id, a);
      d[`${m.id}::${a}`] = v === null ? "" : String(v);
    }));
    setDraft(d);
    setEditMode(true);
  }

  async function saveScores() {
    setSaving(true);
    try {
      const upserts = [];
      const deletes = [];
      MODULES.forEach((m) => m.areas.forEach((a) => {
        const key = `${m.id}::${a}`;
        const raw = (draft[key] ?? "").trim();
        const existing = quizFor(m.id, a);
        if (raw === "") {
          if (existing !== null) deletes.push({ module_id: m.id, functional_area: a });
        } else {
          const n = Math.max(0, Math.min(100, Math.round(Number(raw))));
          if (!Number.isNaN(n)) upserts.push({ user_id: userId, module_id: m.id, functional_area: a, score: n, updated_at: new Date().toISOString() });
        }
      }));
      if (upserts.length) {
        await supabase.from("quiz_scores").upsert(upserts, { onConflict: "user_id,module_id,functional_area" });
      }
      for (const d of deletes) {
        await supabase.from("quiz_scores").delete().eq("user_id", userId).eq("module_id", d.module_id).eq("functional_area", d.functional_area);
      }
      await load();
      setEditMode(false);
    } finally {
      setSaving(false);
    }
  }

  if (cards === null) return <p className="empty">Loading readiness…</p>;

  const hasData = cards.length > 0 || quizRows.length > 0;

  return (
    <div>
      <div className="card rd-overall">
        <div className="rd-overall-text">
          <div className="eyebrow">Exam readiness</div>
          <h1 style={{ margin: "6px 0 8px" }}>Overall</h1>
          <div className="rd-stats">
            <span><strong>{overallStats.count}</strong> cards</span>
            <span className="rd-dot">·</span>
            <span>flashcards <strong>{overallFlash === null ? "—" : `${overallFlash}%`}</strong></span>
            <span className="rd-dot">·</span>
            <span>quiz <strong>{overallQuiz === null ? "—" : `${overallQuiz}%`}</strong></span>
            {overallStats.overdue > 0 && (
              <>
                <span className="rd-dot">·</span>
                <span className="rd-overdue"><strong>{overallStats.overdue}</strong> overdue</span>
              </>
            )}
          </div>
          <p className="rd-method">
            Blended from flashcard retention and your quiz scores (quiz weighted higher; overdue cards
            count for less). Review in the <Link href="/dock" className="today-link">Dock</Link>,
            <Link href="/practice" className="today-link"> practice</Link>, or enter ASCM quiz scores to
            raise it. Target: 80%.
          </p>
        </div>
        <Ring pct={overallCombined} />
      </div>

      {!hasData ? (
        <div className="card">
          <div className="empty">
            No data yet. <Link href="/generate" className="today-link">Generate flashcards</Link>, take a
            <Link href="/practice" className="today-link"> practice quiz</Link>, or enter your ASCM quiz scores below.
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="ghost" onClick={startEdit}>Enter quiz scores</button>
          </div>
        </div>
      ) : editMode ? (
        <div className="card">
          <h2>Enter quiz scores <span className="rd-edit-hint">last score per functional area (0–100), blank to clear</span></h2>
          <div className="rd-editor">
            {MODULES.map((m) => (
              <div key={m.id} className="rd-edit-module">
                <div className="rd-edit-mtitle">M{m.id} — {m.title.split(",")[0]}</div>
                {m.areas.map((a) => (
                  <div key={a} className="rd-edit-row">
                    <span className="rd-edit-area">{a}</span>
                    <input
                      type="number" min="0" max="100" inputMode="numeric" placeholder="—"
                      value={draft[`${m.id}::${a}`] ?? ""}
                      onChange={(e) => setDraft((d) => ({ ...d, [`${m.id}::${a}`]: e.target.value }))}
                    />
                    <span className="rd-edit-pct">%</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="row" style={{ marginTop: 14 }}>
            <button onClick={saveScores} disabled={saving}>{saving ? "Saving…" : "Save scores"}</button>
            <button className="ghost" onClick={() => setEditMode(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="card">
          <h2>
            By module &amp; topic
            <button className="ghost small" onClick={startEdit}>Enter quiz scores</button>
          </h2>
          <div className="rd-list">
            {MODULES.map((m) => {
              const cardsIn = byModule[m.id] || [];
              const mb = moduleBlend(m);
              const open = openModules[m.id];
              const hasCards = cardsIn.length > 0;
              const expandable = hasCards || (m.areas || []).some((a) => quizFor(m.id, a) !== null);
              return (
                <div className="rd-module" key={m.id}>
                  <Row kind="module" caret={expandable ? (open ? "▾" : "▸") : "·"}
                    name={`M${m.id} — ${m.title.split(",")[0]}`} pct={mb.combined} count={cardsIn.length}
                    quiz={mb.q} onClick={expandable ? () => setOpenModules((o) => ({ ...o, [m.id]: !o[m.id] })) : undefined} />

                  {open && expandable && (
                    <div className="rd-areas">
                      {areaGroups(m.id).map(({ area, cards: areaCards }) => {
                        const f = readiness(areaCards, today).pct;
                        const q = quizFor(m.id, area);
                        const combined = blendReadiness(f, q);
                        const key = `${m.id}::${area}`;
                        const aopen = openAreas[key];
                        const areaExpandable = areaCards.length > 0;
                        return (
                          <div key={key}>
                            <Row kind="area" caret={areaExpandable ? (aopen ? "▾" : "▸") : "·"} name={area}
                              pct={combined} count={areaCards.length} quiz={q}
                              onClick={areaExpandable ? () => setOpenAreas((o) => ({ ...o, [key]: !o[key] })) : undefined} />
                            {aopen && areaExpandable && (
                              <div className="rd-topics">
                                {topicGroups(areaCards).map(({ topic, cards: topicCards }) => (
                                  <Row key={topic} kind="topic" name={topic} pct={readiness(topicCards, today).pct} count={topicCards.length} quiz={null} />
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
