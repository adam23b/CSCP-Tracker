"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";
import { MODULES, STEP_DAYS, dayStr } from "../lib/constants";
import { publicUrl } from "../lib/storage";

// Swipe thresholds (px)
const SWIPE_X = 80;
const SWIPE_Y = 70;

export default function DockMode({ session }) {
  const userId = session.user.id;
  const [queue, setQueue] = useState(null); // null = loading
  const [totalAtStart, setTotalAtStart] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [leaving, setLeaving] = useState(null); // 'again' | 'good' | 'easy' during exit animation
  const [startedAt] = useState(() => Date.now());
  const [graded, setGraded] = useState({ again: 0, good: 0, easy: 0 });
  const touchStart = useRef(null);
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    const today = dayStr(new Date());
    const { data } = await supabase
      .from("cards")
      .select("*")
      .eq("user_id", userId)
      .lte("due_date", today)
      .order("due_date", { ascending: true });
    setQueue(data || []);
    setTotalAtStart((data || []).length);
  }

  const card = queue && queue.length > 0 ? queue[0] : null;
  const done = queue !== null && queue.length === 0;
  const reviewed = graded.again + graded.good + graded.easy;
  const progress = totalAtStart > 0 ? reviewed / totalAtStart : 1;

  async function grade(result) {
    if (!card || leaving) return;
    setLeaving(result);

    let step = card.step;
    if (result === "again") step = 0;
    else if (result === "good") step = Math.min(step + 1, STEP_DAYS.length - 1);
    else step = Math.min(step + 2, STEP_DAYS.length - 1);
    const d = new Date();
    d.setDate(d.getDate() + STEP_DAYS[step]);
    const due_date = dayStr(d);

    supabase.from("cards").update({ step, due_date }).eq("id", card.id).then(() => {});

    setTimeout(() => {
      setGraded((g) => ({ ...g, [result]: g[result] + 1 }));
      setQueue((q) => {
        const rest = q.slice(1);
        // "Again" cards return to the back of today's queue so the session ends only when everything sticks.
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
    return (
      <div className="dock">
        <DockTop progress={1} reviewed={reviewed} total={totalAtStart} />
        <div className="dock-done">
          <div className="dock-done-mark">⚓</div>
          <h1 className="dock-done-title">{totalAtStart === 0 ? "Nothing due" : "Queue clear"}</h1>
          <p className="dock-done-sub">
            {totalAtStart === 0
              ? "No cards waiting today. Add cards as you study and they'll surface here when it's time."
              : `${reviewed} review${reviewed === 1 ? "" : "s"} in ${mins} min · ${graded.easy} easy · ${graded.good} good · ${graded.again} again`}
          </p>
          <Link href="/" className="dock-return">Back to the Route</Link>
        </div>
      </div>
    );
  }

  // --- Reviewing ---
  return (
    <div className="dock">
      <DockTop progress={progress} reviewed={reviewed} total={totalAtStart} />

      <div
        className={`dock-card ${leaving ? "leave-" + leaving : ""} ${hintClass}`}
        style={dragStyle}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={() => !revealed && setRevealed(true)}
      >
        <div className="dock-module">{`M${card.module_id} · ${moduleName}`}</div>
        <div className="dock-front">{card.front}</div>
        {card.image_path && <img className="dock-image" src={publicUrl(card.image_path)} alt="" />}
        {revealed ? (
          <div className="dock-back">{card.back}</div>
        ) : (
          <div className="dock-reveal-hint">Tap to reveal</div>
        )}
      </div>

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
