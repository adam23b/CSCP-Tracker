"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";
import { MODULES, dayStr } from "../lib/constants";

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function AudioMode({ session }) {
  const userId = session.user.id;
  const [phase, setPhase] = useState("setup"); // setup | player
  const [supported, setSupported] = useState(true);
  const [error, setError] = useState("");
  const [loadingCards, setLoadingCards] = useState(false);

  // setup options
  const [moduleId, setModuleId] = useState(0);
  const [area, setArea] = useState("");
  const [dueOnly, setDueOnly] = useState(false);
  const [rate, setRate] = useState(1);
  const [recallGap, setRecallGap] = useState(5);
  const [shuffle, setShuffle] = useState(true);

  // player display state
  const [queue, setQueue] = useState([]);
  const [cardIdx, setCardIdx] = useState(0);
  const [part, setPart] = useState("front"); // front | back
  const [playing, setPlaying] = useState(false);
  const [done, setDone] = useState(false);

  // refs used by the speech loop (avoid stale closures)
  const playingRef = useRef(false);
  const idxRef = useRef(0);
  const partRef = useRef("front");
  const queueRef = useRef([]);
  const timerRef = useRef(null);
  const tokenRef = useRef(0); // invalidates stale utterance callbacks
  const rateRef = useRef(1);
  const gapRef = useRef(5);
  const voiceRef = useRef(null);
  const wakeRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setSupported(false);
      return;
    }
    const pick = () => {
      const voices = window.speechSynthesis.getVoices();
      voiceRef.current =
        voices.find((v) => /en[-_]US/i.test(v.lang)) ||
        voices.find((v) => /^en/i.test(v.lang)) ||
        voices[0] ||
        null;
    };
    pick();
    window.speechSynthesis.onvoiceschanged = pick;

    const onVis = () => {
      if (document.visibilityState === "visible" && playingRef.current) requestWake();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = null;
      hardStop();
      releaseWake();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function requestWake() {
    try {
      if (navigator.wakeLock && !wakeRef.current) wakeRef.current = await navigator.wakeLock.request("screen");
    } catch {
      /* wake lock unavailable — fine */
    }
  }
  function releaseWake() {
    try {
      wakeRef.current?.release();
    } catch {
      /* ignore */
    }
    wakeRef.current = null;
  }

  function hardStop() {
    playingRef.current = false;
    tokenRef.current++;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
  }

  function speakCurrent() {
    if (!playingRef.current) return;
    const card = queueRef.current[idxRef.current];
    if (!card) {
      finish();
      return;
    }
    const myToken = tokenRef.current;
    const text = partRef.current === "front" ? card.front : `Answer. ${card.back}`;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = rateRef.current;
    if (voiceRef.current) u.voice = voiceRef.current;
    u.onend = () => {
      if (!playingRef.current || myToken !== tokenRef.current) return;
      if (partRef.current === "front") {
        timerRef.current = setTimeout(() => {
          if (!playingRef.current || myToken !== tokenRef.current) return;
          partRef.current = "back";
          setPart("back");
          speakCurrent();
        }, gapRef.current * 1000);
      } else {
        timerRef.current = setTimeout(() => {
          if (!playingRef.current || myToken !== tokenRef.current) return;
          autoNext();
        }, 1400);
      }
    };
    try {
      window.speechSynthesis.speak(u);
    } catch {
      /* ignore */
    }
  }

  function goTo(nextIdx, nextPart) {
    if (nextIdx < 0 || nextIdx >= queueRef.current.length) return;
    tokenRef.current++;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
    idxRef.current = nextIdx;
    setCardIdx(nextIdx);
    partRef.current = nextPart;
    setPart(nextPart);
    if (playingRef.current) speakCurrent();
  }

  function autoNext() {
    if (idxRef.current + 1 >= queueRef.current.length) {
      finish();
      return;
    }
    goTo(idxRef.current + 1, "front");
  }

  function finish() {
    hardStop();
    releaseWake();
    setPlaying(false);
    setDone(true);
  }

  function togglePlay() {
    if (playingRef.current) {
      playingRef.current = false;
      setPlaying(false);
      tokenRef.current++;
      if (timerRef.current) clearTimeout(timerRef.current);
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* ignore */
      }
      releaseWake();
    } else {
      playingRef.current = true;
      setPlaying(true);
      setDone(false);
      requestWake();
      speakCurrent();
    }
  }

  async function start() {
    setError("");
    setLoadingCards(true);
    try {
      let q = supabase.from("cards").select("*").eq("user_id", userId);
      if (moduleId) q = q.eq("module_id", moduleId);
      if (area) q = q.eq("functional_area", area);
      if (dueOnly) q = q.lte("due_date", dayStr(new Date()));
      const { data } = await q;
      let cards = data || [];
      if (cards.length === 0) {
        setError("No cards in that scope. Widen the selection or turn off ‘Due only’.");
        return;
      }
      cards = shuffle ? shuffleArray(cards) : cards;

      queueRef.current = cards;
      setQueue(cards);
      idxRef.current = 0;
      setCardIdx(0);
      partRef.current = "front";
      setPart("front");
      rateRef.current = rate;
      gapRef.current = recallGap;
      setDone(false);
      setPhase("player");
      playingRef.current = true;
      setPlaying(true);
      requestWake();
      speakCurrent();
    } finally {
      setLoadingCards(false);
    }
  }

  function backToSetup() {
    hardStop();
    releaseWake();
    setPhase("setup");
    setDone(false);
  }

  const areas = MODULES.find((m) => m.id === moduleId)?.areas || [];
  const card = queue[cardIdx];
  const moduleName = card ? MODULES.find((m) => m.id === card.module_id)?.title.split(",")[0] : "";

  // --- Setup ---
  if (phase === "setup") {
    return (
      <div className="card" style={{ maxWidth: 620, margin: "0 auto" }}>
        <h2>Audio review</h2>
        {!supported ? (
          <div className="gen-error">This browser doesn&apos;t support speech synthesis. Try Safari or Chrome.</div>
        ) : (
          <>
            <p className="gen-hint" style={{ margin: "4px 0 12px" }}>
              Hands-free: cards are read aloud — question, a pause to recall, then the answer — advancing automatically.
              Review-only (no grading), so it&apos;s safe to just listen.
            </p>
            <div className="note-form">
              <select value={moduleId} onChange={(e) => { setModuleId(parseInt(e.target.value)); setArea(""); }}>
                <option value={0}>All modules</option>
                {MODULES.map((m) => <option key={m.id} value={m.id}>M{m.id} — {m.title.split(",")[0]}</option>)}
              </select>
              {moduleId !== 0 && (
                <select value={area} onChange={(e) => setArea(e.target.value)}>
                  <option value="">All functional areas</option>
                  {areas.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              )}
              <label className="au-check">
                <input type="checkbox" checked={dueOnly} onChange={(e) => setDueOnly(e.target.checked)} />
                Due cards only (off = review everything in scope)
              </label>
              <label className="au-check">
                <input type="checkbox" checked={shuffle} onChange={(e) => setShuffle(e.target.checked)} />
                Shuffle order
              </label>
              <div className="au-opt-row">
                <span>Speed</span>
                <select value={rate} onChange={(e) => setRate(parseFloat(e.target.value))}>
                  <option value={0.8}>Slower</option>
                  <option value={1}>Normal</option>
                  <option value={1.2}>Faster</option>
                </select>
                <span>Recall pause</span>
                <select value={recallGap} onChange={(e) => setRecallGap(parseInt(e.target.value))}>
                  <option value={3}>3s</option>
                  <option value={5}>5s</option>
                  <option value={8}>8s</option>
                </select>
              </div>
              <div className="row">
                <button onClick={start} disabled={loadingCards}>{loadingCards ? "Loading…" : "▶ Start audio review"}</button>
              </div>
              {error && <div className="gen-error">{error}</div>}
              <div className="au-safety">
                Driving? Mount your phone and start before you set off. Audio pauses if the screen locks or you switch
                apps, so keep this screen on and the app open — and keep your eyes on the road (don&apos;t look at the card).
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // --- Player ---
  return (
    <div className="card au-player" style={{ maxWidth: 620, margin: "0 auto" }}>
      <div className="au-top">
        <span className="au-progress">{cardIdx + 1} / {queue.length}</span>
        <button className="ghost small" onClick={backToSetup}>Exit</button>
      </div>

      {done ? (
        <div className="au-done">
          <div className="au-done-mark">🎧</div>
          <h2>Session complete</h2>
          <p className="gen-hint">You listened through all {queue.length} card{queue.length === 1 ? "" : "s"}.</p>
          <div className="row" style={{ justifyContent: "center" }}>
            <button onClick={() => { goTo(0, "front"); playingRef.current = true; setPlaying(true); setDone(false); requestWake(); speakCurrent(); }}>▶ Replay</button>
            <button className="ghost" onClick={backToSetup}>New session</button>
          </div>
        </div>
      ) : (
        <>
          <div className="au-meta">{card ? `M${card.module_id} · ${card.functional_area || moduleName}${card.topic ? ` · ${card.topic}` : ""}` : ""}</div>
          <div className="au-card">
            <div className="au-part-label">Question</div>
            <div className="au-front">{card?.front}</div>
            {part === "back" && (
              <>
                <div className="au-part-label au-answer-label">Answer</div>
                <div className="au-back">{card?.back}</div>
              </>
            )}
          </div>

          <div className="au-controls">
            <button className="au-btn" onClick={() => goTo(cardIdx - 1, "front")} disabled={cardIdx === 0} aria-label="Previous">⏮</button>
            <button className="au-btn" onClick={() => goTo(cardIdx, "front")} aria-label="Repeat">↺</button>
            <button className="au-btn au-btn-main" onClick={togglePlay} aria-label={playing ? "Pause" : "Play"}>{playing ? "⏸" : "▶"}</button>
            <button className="au-btn" onClick={autoNext} aria-label="Next">⏭</button>
          </div>
          <div className="au-hint">{playing ? "Playing — reading aloud" : "Paused"}</div>
        </>
      )}
    </div>
  );
}
