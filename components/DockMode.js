"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";
import { MODULES, STEP_DAYS, dayStr } from "../lib/constants";
import { publicUrl } from "../lib/storage";
import ExplainModal from "./ExplainModal";

// Swipe thresholds (px)
const SWIPE_X = 80;
const SWIPE_Y = 70;

export default function DockMode({ session }) {
  const userId = session.user.id;
  const [allCards, setAllCards] = useState(null); // every card, loaded once
  const [queue, setQueue] = useState(null); // null = loading; the active filtered session
  const [totalAtStart, setTotalAtStart] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [leaving, setLeaving] = useState(null); // 'again' | 'good' | 'easy' during exit animation
  const [startedAt] = useState(() => Date.now());
  const [graded, setGraded] = useState({ again: 0, good: 0, easy: 0 });
  const touchStart = useRef(null);
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });

  // Auto-logging: tally reviews per module across the whole Dock visit.
  const reviewsByModuleRef = useRef({});
  const loggedRef = useRef(false);
  const [explainCard, setExplainCard] = useState(null);

  // Log a study session (split across modules touched) when leaving the Dock.
  async function flushSession() {
    if (loggedRef.current) return;
    const tally = reviewsByModuleRef.current;
    const mods = Object.keys(tally);
    const totalReviews = mods.reduce((a, k) => a + tally[k], 0);
    if (totalReviews === 0) return;
    loggedRef.current = true;
    const elapsedMin = (Date.now() - startedAt) / 60000;
    // Cap by review count so idle time doesn't inflate the log; floor at 1 min.
    const cappedTotal = Math.min(Math.max(Math.round(elapsedMin), 1), totalReviews * 3);
    const rows = mods.map((k) => ({
      user_id: userId,
      module_id: parseInt(k),
      minutes: Math.max(Math.round((cappedTotal * tally[k]) / totalReviews), 1),
    }));
    await supabase.from("sessions").insert(rows);
  }

  useEffect(() => {
    return () => { flushSession(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Filters ---
  const [filterModule, setFilterModule] = useState(0); // 0 = all modules
  const [filterArea, setFilterArea] = useState(""); // "" = all areas
  const [includeNotDue, setIncludeNotDue] = useState(false); // cram: ignore due date
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    const { data } = await supabase
      .from("cards")
      .select("*")
      .eq("user_id", userId)
      .order("due_date", { ascending: true });
    const cards = data || [];
    setAllCards(cards);
    applyFilter(cards, filterModule, filterArea, includeNotDue);
  }

  function buildQueue(cards, mod, area, notDue) {
    const today = dayStr(new Date());
    return cards.filter((c) => {
      if (!notDue && c.due_date > today) return false;
      if (mod && c.module_id !== mod) return false;
      if (area && (c.functional_area || "") !== area) return false;
      return true;
    });
  }

  // Rebuilding the queue starts a fresh focused session.
  function applyFilter(cards, mod, area, notDue) {
    const q = buildQueue(cards || [], mod, area, notDue);
    setQueue(q);
    setTotalAtStart(q.length);
    setGraded({ again: 0, good: 0, easy: 0 });
    setRevealed(false);
    setLeaving(null);
    setDrag({ x: 0, y: 0, active: false });
  }

  function changeModule(v) {
    const mod = parseInt(v);
    setFilterModule(mod);
    setFilterArea("");
    applyFilter(allCards, mod, "", includeNotDue);
  }
  function changeArea(v) {
    setFilterArea(v);
    applyFilter(allCards, filterModule, v, includeNotDue);
  }
  function changeNotDue(v) {
    setIncludeNotDue(v);
    applyFilter(allCards, filterModule, filterArea, v);
  }

  const card = queue && queue.length > 0 ? queue[0] : null;
  const done = queue !== null && queue.length === 0;
  const reviewed = graded.again + graded.good + graded.easy;
  const progress = totalAtStart > 0 ? reviewed / totalAtStart : 1;
  const filterActive = filterModule !== 0 || filterArea !== "";

  const scopeLabel = useMemo(() => {
    if (filterArea) return filterArea;
    if (filterModule) {
      const m = MODULES.find((x) => x.id === filterModule);
      return `M${filterModule} — ${m?.title.split(",")[0]}`;
    }
    return "All due today";
  }, [filterModule, filterArea]);

  async function grade(result) {
    if (!card || leaving) return;
    reviewsByModuleRef.current[card.module_id] = (reviewsByModuleRef.current[card.module_id] || 0) + 1;
    setLeaving(result);

    let step = card.step;
    if (result === "again") step = 0;
    else if (result === "good") step = Math.min(step + 1, STEP_DAYS.length - 1);
    else step = Math.min(step + 2, STEP_DAYS.length - 1);
    const d = new Date();
    d.setDate(d.getDate() + STEP_DAYS[step]);
    const due_date = dayStr(d);

    supabase.from("cards").update({ step, due_date }).eq("id", card.id).then(() => {});
    // Keep the master list in sync so re-filtering reflects the new schedule.
    setAllCards((cs) => (cs || []).map((x) => (x.id === card.id ? { ...x, step, due_date } : x)));

    setTimeout(() => {
      setGraded((g) => ({ ...g, [result]: g[result] + 1 }));
      setQueue((q) => {
        const rest = q.slice(1);
        // "Again" cards return to the back of the queue so the session ends only when everything sticks.
        return result === "again" ? [...rest, { ...card, step, due_date }] : rest;
      });
      setRevealed(false);
      setLeaving(null);
      setDrag({ x: 0, y: 0, active: false });
    }, 220);
  }

  // --- Touch gestures: left = Again, right = Good, up = Easy (only once revealed) ---
  function onTouchStart(e) {
    if (!revealed) return;
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
    setDrag({ x: 0, y: 0, active: true });
  }
  function onTouchMove(e) {
    if (!touchStart.current) return;
    const t = e.touches[0];
    setDrag({ x: t.clientX - touchStart.current.x, y: t.clientY - touchStart.current.y, active: true });
  }
  function onTouchEnd() {
    if (!touchStart.current) return;
    const { x, y } = drag;
    touchStart.current = null;
    if (y < -SWIPE_Y && Math.abs(x) < SWIPE_X) grade("easy");
    else if (x > SWIPE_X) grade("good");
    else if (x < -SWIPE_X) grade("again");
    else setDrag({ x: 0, y: 0, active: false });
  }

  // --- Keyboard: space/enter reveal, 1/2/3 grade ---
  useEffect(() => {
    function onKey(e) {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (!revealed && card) setRevealed(true);
      } else if (revealed && card) {
        if (e.key === "1") grade("again");
        if (e.key === "2") grade("good");
        if (e.key === "3") grade("easy");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed, card, leaving]);

  const moduleName = useMemo(() => {
    if (!card) return "";
    const m = MODULES.find((x) => x.id === card.module_id);
    return m ? m.title.split(",")[0] : "";
  }, [card]);

  const dragStyle = drag.active
    ? {
        transform: `translate(${drag.x}px, ${Math.min(drag.y, 0)}px) rotate(${drag.x / 30}deg)`,
        transition: "none",
      }
    : undefined;

  const hintClass =
    drag.active && drag.y < -SWIPE_Y ? "hint-easy" :
    drag.active && drag.x > SWIPE_X ? "hint-good" :
    drag.active && drag.x < -SWIPE_X ? "hint-again" : "";

  const areaOptions = filterModule ? MODULES.find((m) => m.id === filterModule)?.areas || [] : [];

  const filterBar = (
    <div className="dock-filter">
      <button className="dock-filter-toggle" onClick={() => setFilterOpen((o) => !o)}>
        <span className="dock-filter-label">{filterOpen ? "▾" : "▸"} Studying: {scopeLabel}{includeNotDue ? " · cram" : ""}</span>
      </button>
      {filterOpen && (
        <div className="dock-filter-panel">
          <select value={filterModule} onChange={(e) => changeModule(e.target.value)}>
            <option value={0}>All modules</option>
            {MODULES.map((m) => (
              <option key={m.id} value={m.id}>M{m.id} — {m.title.split(",")[0]}</option>
            ))}
          </select>
          <select value={filterArea} onChange={(e) => changeArea(e.target.value)} disabled={!filterModule}>
            <option value="">{filterModule ? "All functional areas" : "Pick a module first"}</option>
            {areaOptions.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <label className="dock-filter-check">
            <input type="checkbox" checked={includeNotDue} onChange={(e) => changeNotDue(e.target.checked)} />
            Include not-yet-due (cram this scope)
          </label>
        </div>
      )}
    </div>
  );

  // --- Loading ---
  if (queue === null) {
    return (
      <div className="dock">
        <div className="dock-empty">Casting off…</div>
      </div>
    );
  }

  // --- Complete ---
  if (done) {
    const mins = Math.max(Math.round((Date.now() - startedAt) / 60000), 1);
    let title, sub;
    if (totalAtStart === 0) {
      title = "Nothing to review";
      if (filterActive && !includeNotDue) {
        sub = `No cards due in ${scopeLabel}. Tick "include not-yet-due" above to drill this scope now.`;
      } else if (filterActive) {
        sub = `No cards in ${scopeLabel} yet. Generate some, or widen the filter.`;
      } else {
        sub = "No cards waiting today. Add cards as you study and they'll surface here when it's time.";
      }
    } else {
      title = "Queue clear";
      sub = `${reviewed} review${reviewed === 1 ? "" : "s"} in ${mins} min · ${graded.easy} easy · ${graded.good} good · ${graded.again} again`;
    }
    return (
      <div className="dock">
        <DockTop progress={1} reviewed={reviewed} total={totalAtStart} />
        {filterBar}
        <div className="dock-done">
          <div className="dock-done-mark">⚓</div>
          <h1 className="dock-done-title">{title}</h1>
          <p className="dock-done-sub">{sub}</p>
          {Object.keys(reviewsByModuleRef.current).length > 0 && (
            <div className="dock-autolog">✓ Your review time logs automatically to your study plan.</div>
          )}
          <Link href="/" className="dock-return">Back to the Route</Link>
        </div>
      </div>
    );
  }

  // --- Reviewing ---
  return (
    <div className="dock">
      <DockTop progress={progress} reviewed={reviewed} total={totalAtStart} />
      {filterBar}

      <div
        className={`dock-card ${leaving ? "leave-" + leaving : ""} ${hintClass}`}
        style={dragStyle}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={() => !revealed && setRevealed(true)}
      >
        <div className="dock-module">
          {`M${card.module_id}`}{card.functional_area ? ` · ${card.functional_area}` : ` · ${moduleName}`}{card.topic ? ` · ${card.topic}` : ""}
          {card.exam_priority === "high" && <span className="dock-prio">★ High-yield</span>}
        </div>
        <div className="dock-front">{card.front}</div>
        {card.image_path && <img className="dock-image" src={publicUrl(card.image_path)} alt="" />}
        {revealed ? (
          <div className="dock-back">{card.back}</div>
        ) : (
          <div className="dock-reveal-hint">Tap to reveal</div>
        )}
      </div>

      {revealed && (
        <button className="dock-explain-open" onClick={() => setExplainCard(card)}>
          💬 Ask Claude about this card
        </button>
      )}

      {revealed ? (
        <div className="dock-grades">
          <button className="dock-grade again" onClick={() => grade("again")}>
            Again<span>tomorrow</span>
          </button>
          <button className="dock-grade good" onClick={() => grade("good")}>
            Good<span>{STEP_DAYS[Math.min(card.step + 1, STEP_DAYS.length - 1)]}d</span>
          </button>
          <button className="dock-grade easy" onClick={() => grade("easy")}>
            Easy<span>{STEP_DAYS[Math.min(card.step + 2, STEP_DAYS.length - 1)]}d</span>
          </button>
        </div>
      ) : (
        <button className="dock-reveal" onClick={() => setRevealed(true)}>Show answer</button>
      )}

      <div className="dock-footer">
        <Link href="/" className="dock-exit">Exit</Link>
        <span className="dock-keys">swipe ← again · → good · ↑ easy</span>
      </div>

      {explainCard && (
        <ExplainModal card={explainCard} userId={userId} onClose={() => setExplainCard(null)} />
      )}
    </div>
  );
}

function DockTop({ progress, reviewed, total }) {
  return (
    <div className="dock-top">
      <div className="dock-progress-track">
        <div className="dock-progress-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
      <div className="dock-count mono">{total > 0 ? `${reviewed} / ${total}` : ""}</div>
    </div>
  );
}
